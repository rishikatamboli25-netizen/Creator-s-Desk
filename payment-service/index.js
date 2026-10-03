import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import mongoose from 'mongoose';

import Refund from './models/Refund.js';

import {
  createRefundRequest,
} from './services/refundOrchestrator.js';

import {
  completeWalletRefund,
} from './services/walletRefundService.js';

import {
  applyCodPayoutState,
  processCodPayout,
  reconcileCodPayout,
} from './services/codPayoutService.js';

import customerPayoutRoutes from './routes/customerPayoutRoutes.js';

dotenv.config();

const app = express();

const PORT =
  process.env.PORT || 5004;

const MONGO_URI =
  process.env.MONGO_URI_PAYMENTS ||
  'mongodb://localhost:27017/creatorsdesk_payments';

const ADMIN_INTERNAL_SECRET =
  process.env.ADMIN_INTERNAL_SECRET || '';

const RAZORPAY_WEBHOOK_SECRET =
  process.env.RAZORPAY_WEBHOOK_SECRET || '';

const RAZORPAY_KEY_ID =
  process.env.RAZORPAY_KEY_ID || '';

const RAZORPAY_KEY_SECRET =
  process.env.RAZORPAY_KEY_SECRET || '';

const RAZORPAYX_WEBHOOK_SECRET =
  process.env.RAZORPAYX_WEBHOOK_SECRET || '';

mongoose
  .connect(MONGO_URI)
  .then(async () => {
    await Refund.syncIndexes();

    console.log(
      '✅ Payment Service DB Connected'
    );
  })
  .catch((error) => {
    console.error(
      '❌ Payment DB Connection Error:',
      error
    );
  });

const razorpay = new Razorpay({
  key_id: RAZORPAY_KEY_ID,
  key_secret: RAZORPAY_KEY_SECRET,
});

const requireAdminInternalSecret = (
  req,
  res,
  next
) => {
  if (!ADMIN_INTERNAL_SECRET) {
    return res.status(503).json({
      error:
        'Admin internal access is not configured.',
    });
  }

  if (
    req.headers[
      'x-admin-internal-secret'
    ] !== ADMIN_INTERNAL_SECRET
  ) {
    return res.status(401).json({
      error:
        'Unauthorized internal request.',
    });
  }

  next();
};

const basicAuth = Buffer.from(
  `${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`
).toString('base64');

const razorpayFetch = async (
  path,
  options = {}
) => {
  if (
    !RAZORPAY_KEY_ID ||
    !RAZORPAY_KEY_SECRET
  ) {
    const error = new Error(
      'Razorpay API credentials are not configured.'
    );

    error.status = 503;

    throw error;
  }

  const response = await fetch(
    `https://api.razorpay.com/v1${path}`,
    {
      ...options,
      headers: {
        Accept:
          'application/json',
        Authorization:
          `Basic ${basicAuth}`,
        ...(options.headers || {}),
      },
    }
  );

  const text =
    await response.text();

  let data = {};

  try {
    data = text
      ? JSON.parse(text)
      : {};
  } catch {
    data = {
      error:
        text ||
        'Invalid response from Razorpay.',
    };
  }

  if (!response.ok) {
    const error = new Error(
      data?.error?.description ||
        data?.error?.reason ||
        data?.error_description ||
        `Razorpay request failed (${response.status}).`
    );

    error.status = response.status;
    error.gateway = data;

    throw error;
  }

  return data;
};

const applyGatewayRefundState =
  async ({
    refund,
    gatewayRefund,
    eventId = null,
  }) => {
    const status = String(
      gatewayRefund?.status || ''
    ).toLowerCase();

    /*
     * A terminal refund must never be downgraded
     * by a delayed or duplicate webhook.
     */
    if (
      [
        'PROCESSED',
        'FAILED',
        'CANCELLED',
      ].includes(refund.status)
    ) {
      return refund;
    }

    refund.gatewayRefundId =
      gatewayRefund?.id ||
      refund.gatewayRefundId ||
      null;

    refund.gatewayStatus =
      status ||
      refund.gatewayStatus ||
      null;

    refund.gatewayReference =
      gatewayRefund
        ?.acquirer_data?.arn ||
      gatewayRefund
        ?.acquirer_data?.rrn ||
      gatewayRefund
        ?.acquirer_data?.utr ||
      refund.gatewayReference ||
      null;

    if (eventId) {
      refund.gatewayEventId =
        eventId;
    }

    refund.gatewayResponse =
      gatewayRefund;

    if (status === 'processed') {
      refund.status =
        'PROCESSED';

      refund.processedAt =
        refund.processedAt ||
        new Date();

      refund.failureReason =
        null;
    } else if (
      status === 'failed' ||
      status === 'failure'
    ) {
      refund.status =
        'FAILED';

      refund.failureReason =
        gatewayRefund
          ?.error_description ||
        gatewayRefund
          ?.description ||
        'Razorpay reported that the refund failed.';
    } else {
      refund.status =
        'PENDING';
    }

    await refund.save();

    return refund;
  };

const reconcileGatewayRefund =
  async (refund) => {
    let gatewayRefund = null;

    if (
      refund.gatewayRefundId
    ) {
      gatewayRefund =
        await razorpayFetch(
          `/refunds/${encodeURIComponent(
            refund.gatewayRefundId
          )}`
        );
    } else if (
      refund.paymentId
    ) {
      const list =
        await razorpayFetch(
          `/payments/${encodeURIComponent(
            refund.paymentId
          )}/refunds?count=100`
        );

      const receipt =
        `cd-${refund._id.toString()}`;

      gatewayRefund =
        list?.items?.find(
          (item) =>
            item.receipt ===
            receipt
        ) || null;
    }

    if (!gatewayRefund) {
      return refund;
    }

    return applyGatewayRefundState({
      refund,
      gatewayRefund,
    });
  };

/*
 * Razorpay webhook.
 *
 * Raw body must be captured before
 * express.json() for signature validation.
 */
app.post(
  '/webhooks/razorpay',
  express.raw({
    type: 'application/json',
  }),
  async (req, res) => {
    try {
      if (
        !RAZORPAY_WEBHOOK_SECRET
      ) {
        return res.status(503).json({
          error:
            'Razorpay webhook secret is not configured.',
        });
      }

      const signature =
        req.headers[
          'x-razorpay-signature'
        ];

      const eventId = String(
        req.headers[
          'x-razorpay-event-id'
        ] || ''
      ).trim();

      if (!signature) {
        return res.status(400).json({
          error:
            'Missing Razorpay webhook signature.',
        });
      }

      const rawBody =
        Buffer.isBuffer(req.body)
          ? req.body
          : Buffer.from(
              String(req.body || ''),
              'utf8'
            );

      const expected =
        crypto
          .createHmac(
            'sha256',
            RAZORPAY_WEBHOOK_SECRET
          )
          .update(rawBody)
          .digest('hex');

      const expectedBuffer =
        Buffer.from(
          expected,
          'utf8'
        );

      const receivedBuffer =
        Buffer.from(
          String(signature),
          'utf8'
        );

      if (
        expectedBuffer.length !==
          receivedBuffer.length ||
        !crypto.timingSafeEqual(
          expectedBuffer,
          receivedBuffer
        )
      ) {
        return res.status(401).json({
          error:
            'Invalid Razorpay webhook signature.',
        });
      }

      const payload =
        JSON.parse(
          rawBody.toString('utf8')
        );

      const gatewayRefund =
        payload?.payload?.refund
          ?.entity;

      if (gatewayRefund?.id) {
        let refund =
          await Refund.findOne({
            gatewayRefundId:
              gatewayRefund.id,
          });

        if (
          !refund &&
          gatewayRefund.payment_id
        ) {
          refund =
            await Refund.findOne({
              paymentId:
                gatewayRefund.payment_id,
              amount:
                Number(
                  gatewayRefund.amount ||
                    0
                ) / 100,
              status: {
                $in: [
                  'REQUESTED',
                  'PROCESSING',
                  'PENDING',
                ],
              },
            }).sort({
              createdAt: -1,
            });
        }

        if (
          refund &&
          (!eventId ||
            refund.gatewayEventId !==
              eventId)
        ) {
          await applyGatewayRefundState({
            refund,
            gatewayRefund,
            eventId:
              eventId || null,
          });
        }
      }

      return res.status(200).json({
        received: true,
      });
    } catch (error) {
      console.error(
        '[Payment] Razorpay webhook error:',
        error
      );

      return res.status(400).json({
        error:
          'Unable to process Razorpay webhook.',
      });
    }
  }
);

/*
 * RazorpayX payout webhook.
 */
app.post(
  '/webhooks/razorpayx',
  express.raw({
    type: 'application/json',
  }),
  async (req, res) => {
    try {
      if (
        !RAZORPAYX_WEBHOOK_SECRET
      ) {
        return res.status(503).json({
          error:
            'RazorpayX webhook secret is not configured.',
        });
      }

      const signature =
        req.headers[
          'x-razorpay-signature'
        ];

      const eventId = String(
        req.headers[
          'x-razorpay-event-id'
        ] || ''
      ).trim();

      if (!signature) {
        return res.status(400).json({
          error:
            'Missing RazorpayX webhook signature.',
        });
      }

      const rawBody =
        Buffer.isBuffer(req.body)
          ? req.body
          : Buffer.from(
              String(req.body || ''),
              'utf8'
            );

      const expected =
        crypto
          .createHmac(
            'sha256',
            RAZORPAYX_WEBHOOK_SECRET
          )
          .update(rawBody)
          .digest('hex');

      const expectedBuffer =
        Buffer.from(
          expected,
          'utf8'
        );

      const receivedBuffer =
        Buffer.from(
          String(signature),
          'utf8'
        );

      if (
        expectedBuffer.length !==
          receivedBuffer.length ||
        !crypto.timingSafeEqual(
          expectedBuffer,
          receivedBuffer
        )
      ) {
        return res.status(401).json({
          error:
            'Invalid RazorpayX webhook signature.',
        });
      }

      const payload =
        JSON.parse(
          rawBody.toString('utf8')
        );

      const payout =
        payload?.payload?.payout
          ?.entity;

      if (
        !payout?.id &&
        !payout?.reference_id
      ) {
        return res.status(200).json({
          received: true,
        });
      }

      let refund =
        payout.id
          ? await Refund.findOne({
              payoutId:
                payout.id,
            })
          : null;

      if (
        !refund &&
        payout.reference_id
      ) {
        const referenceId =
          String(
            payout.reference_id
          );

        if (
          referenceId.startsWith(
            'cd-'
          )
        ) {
          refund =
            await Refund.findById(
              referenceId.slice(3)
            );
        }
      }

      if (!refund) {
        return res.status(200).json({
          received: true,
        });
      }

      if (
        eventId &&
        refund.payoutEventId ===
          eventId
      ) {
        return res.status(200).json({
          received: true,
          duplicate: true,
        });
      }

      const payoutAmount =
        Number(
          payout.amount || 0
        ) / 100;

      if (
        Number.isFinite(
          payoutAmount
        ) &&
        Math.round(
          payoutAmount * 100
        ) /
          100 !==
          Math.round(
            Number(
              refund.amount
            ) * 100
          ) /
            100
      ) {
        console.error(
          '[Payment] Ignoring RazorpayX webhook with mismatched payout amount:',
          payout.id
        );

        return res.status(200).json({
          received: true,
        });
      }

      await applyCodPayoutState({
        refund,
        payout,
        eventId:
          eventId || null,
      });

      return res.status(200).json({
        received: true,
      });
    } catch (error) {
      console.error(
        '[Payment] RazorpayX webhook error:',
        error
      );

      return res.status(400).json({
        error:
          'Unable to process RazorpayX webhook.',
      });
    }
  }
);

app.use(cors());

app.use(express.json());

app.get(
  '/health',
  (_req, res) =>
    res.status(200).json({
      service:
        'Payment Service',
      status:
        'Healthy',
    })
);

app.post(
  '/create-order',
  async (req, res) => {
    try {
      const amount = Number(
        req.body?.amount
      );

      if (
        !Number.isFinite(amount) ||
        amount <= 0
      ) {
        return res.status(400).json({
          error:
            'Amount must be greater than zero.',
        });
      }

      const order =
        await razorpay.orders.create({
          amount:
            Math.round(
              amount * 100
            ),
          currency: 'INR',
          receipt:
            `receipt_${Date.now()}`,
        });

      return res.json(
        order
      );
    } catch (error) {
      console.error(
        'Order creation error:',
        error
      );

      return res.status(500).json({
        error:
          error.message,
      });
    }
  }
);

app.post(
  '/verify',
  async (req, res) => {
    try {
      const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
      } = req.body || {};

      if (
        !razorpay_order_id ||
        !razorpay_payment_id ||
        !razorpay_signature
      ) {
        return res.status(400).json({
          message:
            'Payment verification fields are required.',
        });
      }

      const expectedSign =
        crypto
          .createHmac(
            'sha256',
            RAZORPAY_KEY_SECRET
          )
          .update(
            `${razorpay_order_id}|${razorpay_payment_id}`
          )
          .digest('hex');

      if (
        razorpay_signature !==
        expectedSign
      ) {
        return res.status(400).json({
          message:
            'Invalid signature',
        });
      }

      return res.status(200).json({
        message:
          'Payment verified successfully',
        paymentId:
          razorpay_payment_id,
      });
    } catch (error) {
      console.error(
        'Verification error:',
        error
      );

      return res.status(500).json({
        message:
          'Internal Server Error',
      });
    }
  }
);

/*
 * Payment-level refund history.
 *
 * This remains available internally for cases
 * that genuinely operate on a payment ID.
 */
app.get(
  '/admin/payments/:paymentId/refunds',
  requireAdminInternalSecret,
  async (req, res) => {
    try {
      const refunds =
        await Refund.find({
          paymentId:
            req.params.paymentId,
        })
          .sort({
            createdAt: -1,
          })
          .lean();

      return res.status(200).json({
        refunds,
      });
    } catch (error) {
      console.error(
        '[Payment] Refund history error:',
        error
      );

      return res.status(500).json({
        error:
          'Unable to fetch refund history.',
      });
    }
  }
);

/*
 * CANONICAL CD_ADMIN REFUND HISTORY ENDPOINT.
 *
 * Frontend:
 * adminApi.refundHistory(orderId)
 *
 * CD_ADMIN:
 * /api/admin/payments/refunds/:orderId
 *
 * Payment Service:
 * /admin/payments/refunds/:orderId
 *
 * Refund records are queried by orderId.
 */
app.get(
  '/admin/payments/refunds/:orderId',
  requireAdminInternalSecret,
  async (req, res) => {
    try {
      const orderId = String(
        req.params.orderId || ''
      ).trim();

      if (!orderId) {
        return res.status(400).json({
          error:
            'Order ID is required.',
        });
      }

      const refunds =
        await Refund.find({
          orderId,
        })
          .sort({
            createdAt: -1,
          })
          .lean();

      return res.status(200).json({
        refunds,
      });
    } catch (error) {
      console.error(
        '[Payment] Order refund history error:',
        error
      );

      return res.status(500).json({
        error:
          'Unable to fetch refund history.',
      });
    }
  }
);

app.post(
  '/admin/refunds',
  requireAdminInternalSecret,
  async (req, res) => {
    try {
      const result =
        await createRefundRequest(
          req.body || {}
        );

      const refund =
        result.refund;

      if (
        refund.refundMethod ===
          'ORIGINAL_PAYMENT' &&
        !result.idempotent
      ) {
        refund.status =
          'PROCESSING';

        await refund.save();

        try {
          const payment =
            await razorpayFetch(
              `/payments/${encodeURIComponent(
                refund.paymentId
              )}`
            );

          const requestedPaise =
            Math.round(
              Number(
                refund.amount
              ) * 100
            );

          const capturedPaise =
            Number(
              payment?.amount ||
                0
            );

          const refundedPaise =
            Number(
              payment?.amount_refunded ||
                0
            );

          const remainingPaise =
            capturedPaise -
            refundedPaise;

          if (
            payment?.status !==
            'captured'
          ) {
            /*
             * Do not rely on payment status alone;
             * remaining refundable amount is authoritative.
             */
            if (
              remainingPaise <= 0
            ) {
              refund.status =
                'FAILED';

              refund.failureReason =
                'Razorpay reports no remaining refundable amount for this payment.';

              await refund.save();

              return res
                .status(400)
                .json({
                  error:
                    refund.failureReason,
                  refund,
                });
            }
          }

          if (
            !Number.isFinite(
              capturedPaise
            ) ||
            requestedPaise >
              remainingPaise
          ) {
            refund.status =
              'FAILED';

            refund.failureReason =
              'Refund exceeds the remaining refundable amount.';

            await refund.save();

            return res
              .status(400)
              .json({
                error:
                  refund.failureReason,
                refund,
              });
          }

          const gatewayRefund =
            await razorpayFetch(
              `/payments/${encodeURIComponent(
                refund.paymentId
              )}/refund`,
              {
                method:
                  'POST',
                headers: {
                  'Content-Type':
                    'application/json',
                  'X-Refund-Idempotency':
                    refund.idempotencyKey,
                },
                body:
                  JSON.stringify({
                    amount:
                      requestedPaise,
                    speed:
                      'normal',
                    receipt:
                      `cd-${refund._id.toString()}`,
                    notes: {
                      source:
                        refund.source,
                      reasonCode:
                        refund.reasonCode,
                    },
                  }),
              }
            );

          /*
           * PROCESSING/PENDING until
           * gateway says processed/failed.
           */
          await applyGatewayRefundState({
            refund,
            gatewayRefund,
          });
        } catch (error) {
          console.error(
            '[Payment] Razorpay refund request error:',
            error
          );

          /*
           * Permanent request/payment validation
           * errors can become final FAILED.
           *
           * Rate limits, conflicts, network errors,
           * and gateway 5xx responses are outcome-
           * unknown and remain active until reconciliation.
           */
          const permanentFailure =
            [
              400,
              401,
              403,
              404,
              422,
            ].includes(
              error?.status
            );

          if (
            permanentFailure
          ) {
            refund.status =
              'FAILED';

            refund.failureReason =
              error.message;

            refund.gatewayResponse =
              error.gateway ||
              null;

            await refund.save();

            return res
              .status(
                error.status
              )
              .json({
                error:
                  error.message,
                refund,
              });
          }

          refund.status =
            'PROCESSING';

          refund.failureReason =
            'Razorpay response was not received. Reconcile the gateway state before retrying.';

          await refund.save();

          return res
            .status(202)
            .json({
              message:
                'Refund request sent, but the Razorpay response was not received. A second refund is blocked until reconciliation.',
              refund,
              nextAction:
                'RECONCILE_GATEWAY_REFUND',
            });
        }
      }

      return res
        .status(
          result.idempotent
            ? 200
            : 201
        )
        .json({
          message:
            result.idempotent
              ? 'Refund request already exists.'
              : 'Refund request created.',
          refund:
            result.refund,
          walletLedgerEntry:
            result.walletLedgerEntry ||
            null,
          idempotent:
            result.idempotent,
          nextAction:
            result.nextAction ||
            null,
        });
    } catch (error) {
      console.error(
        '[Payment] Refund orchestration error:',
        error
      );

      return res
        .status(
          error.status || 500
        )
        .json({
          error:
            error.message ||
            'Unable to create refund request.',
          refund:
            error.refund ||
            null,
        });
    }
  }
);

app.post(
  '/admin/refunds/:refundId/payout',
  requireAdminInternalSecret,
  async (req, res) => {
    try {
      const result =
        await processCodPayout(
          req.params.refundId
        );

      const statusCode =
        result?.refund?.status ===
        'PROCESSING'
          ? 202
          : result?.idempotent
            ? 200
            : 201;

      return res
        .status(statusCode)
        .json({
          message:
            result?.refund
              ?.status ===
            'PROCESSED'
              ? 'COD payout was processed.'
              : result?.refund
                  ?.status ===
                'FAILED'
                ? 'COD payout failed.'
                : 'COD payout request sent; waiting for RazorpayX payout status.',
          ...result,
        });
    } catch (error) {
      console.error(
        '[Payment] COD payout processing error:',
        error
      );

      return res
        .status(
          error.status || 502
        )
        .json({
          error:
            error.message ||
            'Unable to process COD payout.',
          refund:
            error.refund ||
            null,
        });
    }
  }
);

app.post(
  '/admin/refunds/:refundId/payout/reconcile',
  requireAdminInternalSecret,
  async (req, res) => {
    try {
      return res
        .status(200)
        .json(
          await reconcileCodPayout(
            req.params.refundId
          )
        );
    } catch (error) {
      console.error(
        '[Payment] COD payout reconciliation error:',
        error
      );

      return res
        .status(
          error.status || 502
        )
        .json({
          error:
            error.message ||
            'Unable to reconcile COD payout.',
        });
    }
  }
);

app.post(
  '/admin/refunds/:refundId/wallet/reconcile',
  requireAdminInternalSecret,
  async (req, res) => {
    try {
      const refund =
        await Refund.findById(
          req.params.refundId
        );

      if (!refund) {
        return res.status(404).json({
          error:
            'Refund not found.',
        });
      }

      if (
        refund.refundMethod !==
        'WALLET_CREDIT'
      ) {
        return res.status(400).json({
          error:
            'Wallet reconciliation applies only to wallet-credit refunds.',
        });
      }

      const result =
        await completeWalletRefund(
          refund
        );

      return res.status(200).json({
        message:
          result.refund
            ?.status ===
          'PROCESSED'
            ? 'Wallet refund is processed.'
            : 'Wallet refund remains pending.',
        ...result,
      });
    } catch (error) {
      console.error(
        '[Payment] Wallet refund reconciliation error:',
        error
      );

      return res
        .status(
          error.status || 500
        )
        .json({
          error:
            error.message ||
            'Unable to reconcile wallet refund.',
          refund:
            error.refund ||
            null,
        });
    }
  }
);

app.post(
  '/admin/refunds/:refundId/reconcile',
  requireAdminInternalSecret,
  async (req, res) => {
    try {
      const refund =
        await Refund.findById(
          req.params.refundId
        );

      if (!refund) {
        return res.status(404).json({
          error:
            'Refund not found.',
        });
      }

      if (
        refund.refundMethod !==
        'ORIGINAL_PAYMENT'
      ) {
        return res.status(400).json({
          error:
            'Gateway reconciliation applies only to original-payment refunds.',
        });
      }

      if (
        refund.status ===
        'PROCESSED'
      ) {
        return res.status(200).json({
          message:
            'Razorpay has already returned a processed response for this refund.',
          refund,
        });
      }

      const updated =
        await reconcileGatewayRefund(
          refund
        );

      const message =
        updated.status ===
        'PROCESSED'
          ? 'Razorpay returned a processed response.'
          : updated.status ===
              'FAILED'
            ? 'Razorpay returned a failed response.'
            : 'No final Razorpay response is available yet; the refund remains processing.';

      return res.status(200).json({
        message,
        refund: updated,
      });
    } catch (error) {
      console.error(
        '[Payment] Refund reconciliation error:',
        error
      );

      return res
        .status(
          error.status || 502
        )
        .json({
          error:
            error.message ||
            'Unable to reconcile refund with Razorpay.',
        });
    }
  }
);

app.use(
  customerPayoutRoutes
);

app.listen(
  PORT,
  '0.0.0.0',
  () =>
    console.log(
      `💳 Payment Service running on port ${PORT}`
    )
);