import express from 'express';
import { requireCustomerAuth } from '../middleware/customerAuth.js';
import {
  getCustomerPayoutProfile,
  upsertCustomerPayoutProfile
} from '../services/payoutProfileService.js';
import Refund from '../models/Refund.js';

const router = express.Router();
router.use(requireCustomerAuth);

router.get('/payout-profile', async (req, res) => {
  try {
    const profile = await getCustomerPayoutProfile(req.customer.userId);
    return res.status(200).json({ profile });
  } catch (error) {
    console.error('[Payment] Customer payout profile read error:', error);
    return res.status(error.status || 500).json({
      error: error.message || 'Unable to load payout profile.'
    });
  }
});

router.put('/payout-profile', async (req, res) => {
  try {
    const { method, details } = req.body || {};

    const profile = await upsertCustomerPayoutProfile({
      userId: req.customer.userId,
      method,
      details
    });

    return res.status(200).json({
      message: 'Payout details received successfully.',
      profile
    });
  } catch (error) {
    console.error('[Payment] Customer payout profile update error:', error);
    return res.status(error.status || 500).json({
      error: error.message || 'Unable to save payout details.'
    });
  }
});

router.get('/refunds/me', async (req, res) => {
  try {
    const refunds = await Refund.find({ userId: req.customer.userId })
      .select(
        'orderId amount currency source refundMethod reasonCode reasonNote status gatewayRefundId gatewayStatus gatewayReference createdAt processedAt failureReason payoutProfileId'
      )
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    return res.status(200).json({ refunds });
  } catch (error) {
    console.error('[Payment] Customer refund list error:', error);
    return res.status(500).json({
      error: 'Unable to load your refund requests.'
    });
  }
});

export default router;
