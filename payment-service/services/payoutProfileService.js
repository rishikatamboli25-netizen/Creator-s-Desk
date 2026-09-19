import 'dotenv/config';
import crypto from 'crypto';
import PayoutProfile from '../models/PayoutProfile.js';
import Refund from '../models/Refund.js';

const ENCRYPTION_KEY_HEX = process.env.PAYOUT_ENCRYPTION_KEY || '';
const ALGORITHM = 'aes-256-gcm';

const getEncryptionKey = () => {
  if (!/^[0-9a-fA-F]{64}$/.test(ENCRYPTION_KEY_HEX)) {
    const error = new Error(
      'PAYOUT_ENCRYPTION_KEY must be a 64-character hexadecimal key.'
    );
    error.status = 503;
    throw error;
  }

  return Buffer.from(ENCRYPTION_KEY_HEX, 'hex');
};

const encryptDetails = (details) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  const plaintext = JSON.stringify(details);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);

  return {
    payoutDetailsEncrypted: encrypted.toString('base64'),
    payoutDetailsIv: iv.toString('base64'),
    payoutDetailsAuthTag: cipher.getAuthTag().toString('base64'),
  };
};

const decryptDetails = ({ encryptedDetails, iv, authTag }) => {
  if (!encryptedDetails || !iv || !authTag) {
    const error = new Error('Saved payout details are incomplete.');
    error.status = 500;
    throw error;
  }

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    getEncryptionKey(),
    Buffer.from(iv, 'base64')
  );

  decipher.setAuthTag(Buffer.from(authTag, 'base64'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedDetails, 'base64')),
    decipher.final(),
  ]);

  return JSON.parse(decrypted.toString('utf8'));
};

const maskUpi = (upiId) => {
  const [local, domain] = String(upiId || '').split('@');
  if (!local || !domain) return '••••';

  const visible = local.length <= 2
    ? `${local[0] || ''}•••`
    : `${local.slice(0, 2)}•••`;

  return `${visible}@${domain}`;
};

const maskAccount = (accountNumber) => {
  const clean = String(accountNumber || '').replace(/\s+/g, '');
  return `••••••${clean.slice(-4)}`;
};

const buildMaskedDisplay = ({ method, details }) => {
  if (method === 'UPI') return maskUpi(details.upiId);
  return `A/C ${maskAccount(details.accountNumber)} · ${details.ifsc}`;
};

export const validateAndNormalizePayoutDetails = ({ method, details = {} }) => {
  const cleanMethod = String(method || '').trim().toUpperCase();

  if (!['UPI', 'BANK_ACCOUNT'].includes(cleanMethod)) {
    const error = new Error('Choose a valid payout method.');
    error.status = 400;
    throw error;
  }

  if (cleanMethod === 'UPI') {
    const upiId = String(details.upiId || '').trim().toLowerCase();

    if (!/^[a-z0-9._-]{2,100}@[a-z0-9.-]{2,100}$/.test(upiId)) {
      const error = new Error('Enter a valid UPI ID.');
      error.status = 400;
      throw error;
    }

    return {
      method: cleanMethod,
      details: { upiId },
      maskedDisplay: buildMaskedDisplay({
        method: cleanMethod,
        details: { upiId },
      }),
    };
  }

  const accountHolderName = String(
    details.accountHolderName || ''
  ).trim().replace(/\s+/g, ' ');
  const accountNumber = String(details.accountNumber || '').replace(/\s+/g, '');
  const ifsc = String(details.ifsc || '').trim().toUpperCase();

  if (!/^[A-Za-z][A-Za-z .'-]{1,100}$/.test(accountHolderName)) {
    const error = new Error('Enter the account holder name.');
    error.status = 400;
    throw error;
  }

  if (!/^\d{6,30}$/.test(accountNumber)) {
    const error = new Error('Enter a valid bank account number.');
    error.status = 400;
    throw error;
  }

  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) {
    const error = new Error('Enter a valid IFSC code.');
    error.status = 400;
    throw error;
  }

  const normalizedDetails = { accountHolderName, accountNumber, ifsc };

  return {
    method: cleanMethod,
    details: normalizedDetails,
    maskedDisplay: buildMaskedDisplay({
      method: cleanMethod,
      details: normalizedDetails,
    }),
  };
};

const toCustomerProfile = (profile) => {
  if (!profile) return null;

  const details = decryptDetails({
    encryptedDetails: profile.encryptedDetails,
    iv: profile.iv,
    authTag: profile.authTag,
  });

  return {
    _id: profile._id,
    userId: profile.userId,
    status: profile.status,
    method: profile.method,
    version: profile.version || 1,
    maskedDisplay: profile.maskedDisplay,
    verifiedAt: profile.verifiedAt,
    updatedAt: profile.updatedAt,
    details,
  };
};

const profileProjection =
  '_id userId status method version maskedDisplay verifiedAt updatedAt +encryptedDetails +iv +authTag';

const usableStatuses = ['PENDING_VERIFICATION', 'VERIFIED'];

export const getCustomerPayoutProfile = async (userId) => {
  const profile = await PayoutProfile.findOne({ userId })
    .select(profileProjection)
    .lean();

  return toCustomerProfile(profile);
};

export const findReusablePayoutProfile = async ({
  userId,
  allowedStatuses = usableStatuses,
}) => {
  if (!userId) return null;

  const profile = await PayoutProfile.findOne({
    userId: String(userId),
    status: { $in: allowedStatuses },
  })
    .select(profileProjection)
    .lean();

  if (!profile) return null;

  return {
    _id: profile._id,
    userId: profile.userId,
    status: profile.status,
    method: profile.method,
    version: profile.version || 1,
    maskedDisplay: profile.maskedDisplay,
    details: decryptDetails({
      encryptedDetails: profile.encryptedDetails,
      iv: profile.iv,
      authTag: profile.authTag,
    }),
  };
};

export const createPayoutSnapshot = ({ profile }) => {
  if (!profile?._id || !profile?.userId || !profile?.method || !profile?.details) {
    const error = new Error('A complete payout profile is required.');
    error.status = 400;
    throw error;
  }

  return {
    payoutProfileId: profile._id,
    payoutProfileVersion: profile.version || 1,
    payoutMethodSnapshot: profile.method,
    ...encryptDetails(profile.details),
  };
};

export const getPayoutDetailsForRefund = async ({
  refund,
  allowedStatuses = usableStatuses,
}) => {
  if (!refund?.userId || !refund?.payoutProfileId) return null;

  // New refunds carry an immutable encrypted destination snapshot. It is the
  // destination the payout must use even if the customer edits their profile.
  if (
    refund.payoutDetailsEncrypted &&
    refund.payoutDetailsIv &&
    refund.payoutDetailsAuthTag &&
    refund.payoutMethodSnapshot
  ) {
    return {
      _id: refund.payoutProfileId,
      userId: refund.userId,
      method: refund.payoutMethodSnapshot,
      version: refund.payoutProfileVersion || 1,
      details: decryptDetails({
        encryptedDetails: refund.payoutDetailsEncrypted,
        iv: refund.payoutDetailsIv,
        authTag: refund.payoutDetailsAuthTag,
      }),
    };
  }

  // Backward compatibility for older in-flight refunds created before payout
  // snapshots existed. Once those refunds are reprocessed, future refunds use
  // the immutable snapshot path above.
  const profile = await PayoutProfile.findOne({
    _id: refund.payoutProfileId,
    userId: String(refund.userId),
    status: { $in: allowedStatuses },
  })
    .select(profileProjection)
    .lean();

  if (!profile) return null;

  if (
    refund.payoutProfileVersion &&
    Number(profile.version || 1) !== Number(refund.payoutProfileVersion)
  ) {
    return null;
  }

  return {
    _id: profile._id,
    userId: profile.userId,
    method: profile.method,
    version: profile.version || 1,
    details: decryptDetails({
      encryptedDetails: profile.encryptedDetails,
      iv: profile.iv,
      authTag: profile.authTag,
    }),
  };
};

export const upsertCustomerPayoutProfile = async ({
  userId,
  method,
  details,
}) => {
  const normalized = validateAndNormalizePayoutDetails({ method, details });

  const profile = await PayoutProfile.findOneAndUpdate(
    { userId: String(userId) },
    {
      $set: {
        userId: String(userId),
        status: 'PENDING_VERIFICATION',
        method: normalized.method,
        maskedDisplay: normalized.maskedDisplay,
        ...encryptDetails(normalized.details),
        verifiedAt: null,
      },
      $setOnInsert: {
        version: 0,
      },
      $inc: {
        version: 1,
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  ).select(profileProjection);

  // Every waiting COD refund receives its own encrypted snapshot, so an edit
  // to the customer's profile cannot redirect an already-created refund.
  const waitingRefunds = await Refund.find({
    userId: String(userId),
    refundMethod: 'COD_PAYOUT',
    status: 'AWAITING_CUSTOMER_DETAILS',
  }).select('_id');

  for (const refund of waitingRefunds) {
    const snapshot = createPayoutSnapshot({
      profile: {
        _id: profile._id,
        userId: profile.userId,
        method: profile.method,
        version: profile.version || 1,
        details: normalized.details,
      },
    });

    await Refund.updateOne(
      {
        _id: refund._id,
        status: 'AWAITING_CUSTOMER_DETAILS',
      },
      {
        $set: {
          ...snapshot,
          status: 'PAYOUT_DETAILS_SUBMITTED',
        },
      }
    );
  }

  if (waitingRefunds.length > 0) {
    await PayoutProfile.updateOne(
      { _id: profile._id },
      { $set: { lastUsedAt: new Date() } }
    );
  }

  return toCustomerProfile(profile.toObject());
};
