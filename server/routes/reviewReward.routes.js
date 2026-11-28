const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { getConfig } = require('../services/reviewReward.service');

const router = express.Router();
router.use(requireAuth, requireAdmin);
router.get('/', async (req, res) => {
  try {
    const config = await getConfig();
    res.json({ success: true, config });
  } catch (error) {
    console.error('Error fetching review reward config:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

router.put('/', async (req, res) => {
  try {
    const body = req.body || {};
    const data = {};
    if (body.enabled !== undefined) data.enabled = Boolean(body.enabled);
    if (body.minRating !== undefined) {
      const n = parseInt(body.minRating, 10);
      if (!Number.isInteger(n) || n < 1 || n > 5) {
        return res.status(400).json({
          success: false,
          error: 'minRating must be an integer between 1 and 5.',
        });
      }
      data.minRating = n;
    }
    if (body.amount !== undefined) {
      const n = Number(body.amount);
      if (!Number.isFinite(n) || n < 0) {
        return res.status(400).json({
          success: false,
          error: 'amount must be a non-negative number.',
        });
      }
      data.amount = n;
    }
    if (body.currency !== undefined) {
      data.currency = String(body.currency).trim().toUpperCase().slice(0, 8) || 'ETB';
    }
    if (body.note !== undefined) {
      data.note = body.note ? String(body.note).slice(0, 1000) : null;
    }

    const existing = await getConfig();
    const config = await prisma.reviewRewardConfig.update({
      where: { id: existing.id },
      data: { ...data, updatedBy: req.user?.id || null },
    });
    res.json({ success: true, config });
  } catch (error) {
    console.error('Error updating review reward config:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

module.exports = router;
