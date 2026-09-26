import crypto from 'node:crypto';
import mongoose from 'mongoose';
import Product from '../models/Product.js';
import InventoryReservation from '../models/InventoryReservation.js';
import InventoryMovement from '../models/InventoryMovement.js';

const RESERVATION_MINUTES = Math.max(
  5,
  Number(process.env.INVENTORY_RESERVATION_MINUTES || 20)
);
const COMMIT_HOLD_MINUTES = Math.max(
  60,
  Number(process.env.INVENTORY_COMMIT_HOLD_MINUTES || 1440)
);
const MAX_LINE_QUANTITY = 1000;
const MAX_RESERVATION_LINES = 50;

const fail = (message, status = 400) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const normalizeItems = (items) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw fail('At least one product is required.');
  }

  if (items.length > MAX_RESERVATION_LINES) {
    throw fail(`A checkout can contain at most ${MAX_RESERVATION_LINES} distinct products.`);
  }

  const grouped = new Map();

  for (const raw of items) {
    const productRef = String(raw?.productId || '').trim();
    const quantity = Number(raw?.quantity);

    if (!productRef || productRef.length > 200) {
      throw fail('Every product must have a valid product reference.');
    }

    if (
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > MAX_LINE_QUANTITY
    ) {
      throw fail(
        `Quantity must be a whole number between 1 and ${MAX_LINE_QUANTITY}.`
      );
    }

    const nextQuantity = (grouped.get(productRef) || 0) + quantity;
    if (nextQuantity > MAX_LINE_QUANTITY) {
      throw fail(
        `Quantity for ${productRef} cannot exceed ${MAX_LINE_QUANTITY}.`
      );
    }

    grouped.set(productRef, nextQuantity);
  }

  return [...grouped.entries()].map(([productRef, quantity]) => ({
    productRef,
    quantity,
  }));
};

const reservationResponse = (reservation) => ({
  id: reservation._id.toString(),
  userId: reservation.userId,
  checkoutId: reservation.checkoutId,
  orderId: reservation.orderId,
  status: reservation.status,
  items: reservation.items.map((item) => ({
    productId: item.productId.toString(),
    sku: item.sku,
    name: item.name,
    unitPrice: item.unitPrice,
    quantity: item.quantity,
  })),
  subtotal: reservation.subtotal,
  expiresAt: reservation.expiresAt,
  createdAt: reservation.createdAt,
  committedAt: reservation.committedAt,
  releasedAt: reservation.releasedAt,
});

const writeMovement = async (
  {
    productId,
    reservationId = null,
    orderId = null,
    movementType,
    quantityDelta,
    beforeQuantity,
    afterQuantity,
    reason,
    source,
    actorAdminId = null,
    actorAdminEmail = null,
    requestId = null,
  },
  session = null
) => {
  const payload = {
    productId,
    reservationId,
    orderId,
    movementType,
    quantityDelta,
    beforeQuantity,
    afterQuantity,
    reason: String(reason || '').trim().slice(0, 500),
    source,
    actorAdminId,
    actorAdminEmail,
    requestId,
  };

  if (session) {
    await InventoryMovement.create([payload], { session });
    return;
  }

  await InventoryMovement.create(payload);
};

const productRefsQuery = (refs) => {
  const objectIds = [];
  const slugs = [];

  for (const ref of refs) {
    if (mongoose.isValidObjectId(ref)) objectIds.push(ref);
    else slugs.push(ref);
  }

  const clauses = [];
  if (objectIds.length) clauses.push({ _id: { $in: objectIds } });
  if (slugs.length) clauses.push({ slug: { $in: slugs } });

  return clauses.length === 1 ? clauses[0] : { $or: clauses };
};

const resolveProducts = async (normalizedItems, session = null) => {
  const refs = normalizedItems.map((item) => item.productRef);
  const query = Product.find(productRefsQuery(refs));
  if (session) query.session(session);
  const products = await query.lean();

  const productMap = new Map();
  for (const product of products) {
    productMap.set(String(product._id), product);
    productMap.set(String(product.slug), product);
  }

  return productMap;
};

export const reserveInventory = async ({
  userId,
  items,
  idempotencyKey,
  checkoutId = null,
}) => {
  if (!userId) throw fail('Authenticated customer identity is required.', 401);

  const normalizedItems = normalizeItems(items);
  const finalKey = String(idempotencyKey || checkoutId || '').trim();
  if (!finalKey || finalKey.length > 200) {
    throw fail('Inventory reservation idempotency key is required.');
  }

  const existing = await InventoryReservation.findOne({
    idempotencyKey: finalKey,
  });
  if (existing) {
    if (String(existing.userId) !== String(userId)) {
      throw fail('This reservation belongs to another customer.', 403);
    }
    if (existing.status === 'ACTIVE' && existing.expiresAt <= new Date()) {
      await releaseReservation(existing._id.toString(), {
        userId,
        reason: 'Inventory reservation expired before reuse.',
      });
      throw fail('The previous checkout reservation expired. Please try again.', 409);
    }
    return { reservation: existing, idempotent: true };
  }

  const session = await mongoose.startSession();
  try {
    let reservationId = null;

    await session.withTransaction(async () => {
      const transactionProducts = await resolveProducts(
        normalizedItems,
        session
      );

      const snapshotItems = [];
      for (const item of normalizedItems) {
        const product = transactionProducts.get(item.productRef);
        if (!product) {
          throw fail(`Product ${item.productRef} was not found.`, 404);
        }

        if (Number(product.quantity) < item.quantity) {
          throw fail(
            `${product.name} does not have enough available quantity.`,
            409
          );
        }

        if (product.manualOutOfStock || product.inStock === false) {
          throw fail(`${product.name} is currently unavailable.`, 409);
        }

        snapshotItems.push({
          productId: product._id,
          sku: product.sku || '',
          name: product.name,
          unitPrice: Number(product.price || 0),
          quantity: item.quantity,
          applied: false,
        });
      }

      const subtotal = snapshotItems.reduce(
        (sum, item) => sum + item.unitPrice * item.quantity,
        0
      );

      const reservation = new InventoryReservation({
        idempotencyKey: finalKey,
        userId: String(userId),
        checkoutId: checkoutId ? String(checkoutId).slice(0, 200) : finalKey,
        status: 'ACTIVE',
        items: snapshotItems,
        subtotal,
        expiresAt: new Date(
          Date.now() + RESERVATION_MINUTES * 60 * 1000
        ),
      });

      for (const item of reservation.items) {
        const updated = await Product.findOneAndUpdate(
          {
            _id: item.productId,
            quantity: { $gte: item.quantity },
            manualOutOfStock: false,
            inStock: true,
          },
          {
            $inc: { quantity: -item.quantity },
            $set: { updatedAt: new Date() },
          },
          { new: true, session }
        );

        if (!updated) {
          throw fail(
            `Unable to reserve enough stock for ${item.name}. Please refresh and try again.`,
            409
          );
        }

        item.applied = true;

        await Product.updateOne(
          { _id: updated._id },
          {
            $set: {
              inStock:
                Number(updated.quantity) > 0 &&
                !updated.manualOutOfStock,
            },
          },
          { session }
        );

        await writeMovement(
          {
            productId: updated._id,
            reservationId: reservation._id,
            movementType: 'RESERVED',
            quantityDelta: -item.quantity,
            beforeQuantity: updated.quantity + item.quantity,
            afterQuantity: updated.quantity,
            reason: 'Stock reserved for checkout.',
            source: 'ORDER',
            requestId: finalKey,
          },
          session
        );
      }

      await reservation.save({ session });
      reservationId = reservation._id;
    });

    const reservation = await InventoryReservation.findById(reservationId);
    return { reservation, idempotent: false };
  } catch (error) {
    if (error?.code === 11000) {
      const existingAfterRace = await InventoryReservation.findOne({
        idempotencyKey: finalKey,
      });
      if (
        existingAfterRace &&
        String(existingAfterRace.userId) === String(userId)
      ) {
        return { reservation: existingAfterRace, idempotent: true };
      }
    }

    throw error;
  } finally {
    await session.endSession();
  }
};

export const getReservation = async (reservationId, userId = null) => {
  if (!mongoose.isValidObjectId(reservationId)) {
    throw fail('Invalid inventory reservation ID.');
  }

  const reservation = await InventoryReservation.findById(reservationId);
  if (!reservation) {
    throw fail('Inventory reservation not found.', 404);
  }

  if (
    userId !== null &&
    String(reservation.userId) !== String(userId)
  ) {
    throw fail(
      'Inventory reservation does not belong to this customer.',
      403
    );
  }

  if (
    reservation.status === 'ACTIVE' &&
    reservation.expiresAt <= new Date() &&
    !reservation.orderId
  ) {
    await releaseReservation(reservation._id.toString(), {
      userId: reservation.userId,
      reason: 'Reservation expired.',
    });
    return InventoryReservation.findById(reservation._id);
  }

  return reservation;
};

export const attachReservationOrder = async (
  reservationId,
  { userId = null, orderId }
) => {
  if (!mongoose.isValidObjectId(reservationId)) {
    throw fail('Invalid inventory reservation ID.');
  }
  if (!String(orderId || '').trim()) {
    throw fail('Order ID is required.');
  }

  const reservation = await getReservation(reservationId, userId);
  if (reservation.status === 'COMMITTED') {
    if (
      reservation.orderId &&
      String(reservation.orderId) !== String(orderId)
    ) {
      throw fail('Inventory reservation is already committed to another order.', 409);
    }
    return reservation;
  }
  if (reservation.status !== 'ACTIVE') {
    throw fail(
      `Inventory reservation is ${reservation.status.toLowerCase()} and cannot be attached to an order.`,
      409
    );
  }

  reservation.orderId = String(orderId).trim();
  reservation.expiresAt = new Date(
    Date.now() + COMMIT_HOLD_MINUTES * 60 * 1000
  );
  await reservation.save();
  return reservation;
};

export const commitReservation = async (
  reservationId,
  { userId = null, orderId = null }
) => {
  if (!mongoose.isValidObjectId(reservationId)) {
    throw fail('Invalid inventory reservation ID.');
  }

  const session = await mongoose.startSession();
  try {
    let result = null;

    await session.withTransaction(async () => {
      const reservation = await InventoryReservation.findById(
        reservationId
      ).session(session);

      if (!reservation) throw fail('Inventory reservation not found.', 404);
      if (
        userId !== null &&
        String(reservation.userId) !== String(userId)
      ) {
        throw fail(
          'Inventory reservation does not belong to this customer.',
          403
        );
      }

      if (reservation.status === 'COMMITTED') {
        if (
          orderId &&
          reservation.orderId &&
          String(reservation.orderId) !== String(orderId)
        ) {
          throw fail(
            'Inventory reservation is already committed to another order.',
            409
          );
        }
        result = reservation;
        return;
      }

      if (reservation.status !== 'ACTIVE') {
        throw fail(
          `Inventory reservation is ${reservation.status.toLowerCase()} and cannot be committed.`,
          409
        );
      }

      if (reservation.expiresAt <= new Date() && !reservation.orderId) {
        throw fail('Inventory reservation has expired.', 409);
      }

      reservation.status = 'COMMITTED';
      reservation.orderId = orderId
        ? String(orderId).trim()
        : reservation.orderId;
      reservation.committedAt = new Date();
      await reservation.save({ session });

      for (const item of reservation.items) {
        if (!item.applied) continue;

        const product = await Product.findById(item.productId)
          .select('quantity')
          .session(session)
          .lean();

        const currentQuantity = Number(product?.quantity || 0);

        await writeMovement(
          {
            productId: item.productId,
            reservationId: reservation._id,
            orderId: reservation.orderId,
            movementType: 'RESERVATION_COMMITTED',
            quantityDelta: 0,
            beforeQuantity: currentQuantity,
            afterQuantity: currentQuantity,
            reason: 'Stock reservation committed to order.',
            source: 'ORDER',
          },
          session
        );
      }

      result = reservation;
    });

    return result;
  } finally {
    await session.endSession();
  }
};

export const releaseReservation = async (
  reservationId,
  {
    userId = null,
    reason = 'Stock reservation released.',
    allowCommitted = false,
  } = {}
) => {
  if (!mongoose.isValidObjectId(reservationId)) {
    throw fail('Invalid inventory reservation ID.');
  }

  const session = await mongoose.startSession();
  try {
    let result = null;

    await session.withTransaction(async () => {
      const reservation = await InventoryReservation.findById(
        reservationId
      ).session(session);

      if (!reservation) {
        throw fail('Inventory reservation not found.', 404);
      }
      if (
        userId !== null &&
        String(reservation.userId) !== String(userId)
      ) {
        throw fail(
          'Inventory reservation does not belong to this customer.',
          403
        );
      }
      if (
        reservation.status === 'RELEASED' ||
        reservation.status === 'EXPIRED'
      ) {
        result = reservation;
        return;
      }
      if (
        reservation.status === 'COMMITTED' &&
        !allowCommitted
      ) {
        throw fail(
          'Committed inventory cannot be released through checkout. The order must be cancelled by an authorized operation.',
          409
        );
      }

      if (
        reservation.status !== 'ACTIVE' &&
        reservation.status !== 'COMMITTED'
      ) {
        throw fail(
          `Inventory reservation is ${reservation.status.toLowerCase()} and cannot be released.`,
          409
        );
      }

      for (const item of reservation.items) {
        if (!item.applied) continue;

        const updated = await Product.findByIdAndUpdate(
          item.productId,
          {
            $inc: { quantity: item.quantity },
            $set: { updatedAt: new Date() },
          },
          { new: true, session }
        );

        if (!updated) continue;

        await Product.updateOne(
          { _id: updated._id },
          {
            $set: {
              inStock:
                Number(updated.quantity) > 0 &&
                !updated.manualOutOfStock,
            },
          },
          { session }
        );

        await writeMovement(
          {
            productId: updated._id,
            reservationId: reservation._id,
            orderId: reservation.orderId,
            movementType: 'RESERVATION_RELEASED',
            quantityDelta: item.quantity,
            beforeQuantity: updated.quantity - item.quantity,
            afterQuantity: updated.quantity,
            reason,
            source: 'ORDER',
          },
          session
        );

        item.applied = false;
      }

      const isExpired = reservation.expiresAt <= new Date();
      reservation.status = isExpired ? 'EXPIRED' : 'RELEASED';
      reservation.releasedAt = new Date();
      reservation.releaseReason = String(reason).slice(0, 500);
      await reservation.save({ session });
      result = reservation;
    });

    return result;
  } finally {
    await session.endSession();
  }
};

export const adjustStock = async ({
  productId,
  delta,
  reason,
  actorAdminId,
  actorAdminEmail,
  requestId,
}) => {
  const numericDelta = Number(delta);
  if (!mongoose.isValidObjectId(productId)) {
    throw fail('Invalid product ID.');
  }
  if (!Number.isInteger(numericDelta) || numericDelta === 0) {
    throw fail('Stock adjustment must be a non-zero whole number.');
  }

  const cleanReason = String(reason || '').trim();
  if (!cleanReason) throw fail('A reason is required for stock adjustments.');

  const session = await mongoose.startSession();
  try {
    let updated = null;
    let beforeQuantity = null;

    await session.withTransaction(async () => {
      const current = await Product.findById(productId)
        .select('quantity')
        .session(session)
        .lean();
      if (!current) throw fail('Product not found.', 404);
      beforeQuantity = Number(current.quantity || 0);

      const filter = numericDelta < 0
        ? { _id: productId, quantity: { $gte: Math.abs(numericDelta) } }
        : { _id: productId };

      updated = await Product.findOneAndUpdate(
        filter,
        {
          $inc: { quantity: numericDelta },
          $set: { updatedAt: new Date() },
        },
        { new: true, session }
      );

      if (!updated) {
        throw fail(
          numericDelta < 0
            ? 'Stock cannot be reduced below zero.'
            : 'Product not found.',
          numericDelta < 0 ? 409 : 404
        );
      }

      updated.inStock =
        Number(updated.quantity) > 0 && !updated.manualOutOfStock;
      await updated.save({ session });

      await writeMovement(
        {
          productId: updated._id,
          movementType: 'STOCK_ADJUSTMENT',
          quantityDelta: numericDelta,
          beforeQuantity,
          afterQuantity: updated.quantity,
          reason: cleanReason,
          source: 'ADMIN',
          actorAdminId,
          actorAdminEmail,
          requestId,
        },
        session
      );
    });

    return {
      product: updated,
      beforeQuantity,
      afterQuantity: Number(updated.quantity),
    };
  } finally {
    await session.endSession();
  }
};

export const setManualAvailability = async ({
  productId,
  available,
  reason,
  actorAdminId,
  actorAdminEmail,
  requestId,
}) => {
  if (!mongoose.isValidObjectId(productId)) {
    throw fail('Invalid product ID.');
  }

  const cleanReason = String(reason || '').trim();
  if (!cleanReason) {
    throw fail('A reason is required for availability changes.');
  }

  const session = await mongoose.startSession();
  try {
    let result = null;

    await session.withTransaction(async () => {
      const product = await Product.findById(productId).session(session);
      if (!product) throw fail('Product not found.', 404);

      if (available && Number(product.quantity) <= 0) {
        throw fail(
          'A product cannot be marked available while quantity is zero.',
          409
        );
      }

      const before = {
        manualOutOfStock: Boolean(product.manualOutOfStock),
        inStock: Boolean(product.inStock),
      };

      product.manualOutOfStock = !available;
      product.inStock =
        Number(product.quantity) > 0 && !product.manualOutOfStock;
      await product.save({ session });

      await writeMovement(
        {
          productId: product._id,
          movementType: available
            ? 'MANUAL_AVAILABLE'
            : 'MANUAL_OUT_OF_STOCK',
          quantityDelta: 0,
          beforeQuantity: product.quantity,
          afterQuantity: product.quantity,
          reason: cleanReason,
          source: 'ADMIN',
          actorAdminId,
          actorAdminEmail,
          requestId,
        },
        session
      );

      result = {
        product,
        before,
        after: {
          manualOutOfStock: product.manualOutOfStock,
          inStock: product.inStock,
        },
      };
    });

    return result;
  } finally {
    await session.endSession();
  }
};

export const expireReservations = async () => {
  const expired = await InventoryReservation.find({
    status: 'ACTIVE',
    expiresAt: { $lte: new Date() },
    $or: [{ orderId: null }, { orderId: { $exists: false } }],
  })
    .limit(100)
    .lean();

  for (const reservation of expired) {
    await releaseReservation(reservation._id.toString(), {
      userId: reservation.userId,
      reason: 'Inventory reservation expired automatically.',
    }).catch((error) =>
      console.error(
        '[Inventory] Reservation expiry error:',
        error.message
      )
    );
  }
};

export { reservationResponse, RESERVATION_MINUTES, COMMIT_HOLD_MINUTES };
