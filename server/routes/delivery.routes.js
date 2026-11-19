const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const publicRouter = express.Router();
const adminRouter = express.Router();

const normalizeText = (value) =>
  typeof value === 'string' ? value.trim() : '';

const toNumber = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

// ═══════════════════════════════════════════════════════════
// PUBLIC — list active delivery regions for checkout dropdown
// ═══════════════════════════════════════════════════════════
publicRouter.get('/', async (req, res) => {
  try {
    const regions = await prisma.deliveryRegion.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        country: true,
        fee: true,
      },
    });
    res.json({ success: true, regions });
  } catch (error) {
    console.error('Error fetching delivery regions:', error);
    res.status(500).json({ success: false, error: 'Failed to load delivery regions.' });
  }
});

// ═══════════════════════════════════════════════════════════
// ADMIN — CRUD for delivery regions
// ═══════════════════════════════════════════════════════════
adminRouter.use(requireAuth, requireAdmin);

// GET ALL (admin — includes inactive)
adminRouter.get('/', async (req, res) => {
  try {
    const regions = await prisma.deliveryRegion.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    res.json({ success: true, regions });
  } catch (error) {
    console.error('Error fetching delivery regions:', error);
    res.status(500).json({ success: false, error: 'Failed to load delivery regions.' });
  }
});

// CREATE
adminRouter.post('/', async (req, res) => {
  try {
    const name = normalizeText(req.body?.name);
    const fee = toNumber(req.body?.fee);
    if (!name || name.length > 120 || fee == null || fee < 0) {
      return res.status(400).json({
        success: false,
        error: 'Provide a valid region name and delivery fee.',
      });
    }
    const region = await prisma.deliveryRegion.create({
      data: {
        name,
        country: normalizeText(req.body?.country).slice(0, 120) || null,
        fee,
        active: req.body?.active !== false,
        sortOrder: toNumber(req.body?.sortOrder) ?? 0,
      },
    });
    res.status(201).json({ success: true, region });
  } catch (error) {
    console.error('Error creating delivery region:', error);
    res.status(500).json({ success: false, error: 'Failed to create delivery region.' });
  }
});

// UPDATE
adminRouter.put('/:id', async (req, res) => {
  try {
    const existing = await prisma.deliveryRegion.findUnique({
      where: { id: req.params.id },
    });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Delivery region not found.' });
    }
    const data = {};
    if (req.body?.name !== undefined) {
      const name = normalizeText(req.body.name);
      if (!name || name.length > 120) {
        return res.status(400).json({ success: false, error: 'Invalid region name.' });
      }
      data.name = name;
    }
    if (req.body?.country !== undefined) {
      data.country = normalizeText(req.body.country).slice(0, 120) || null;
    }
    if (req.body?.fee !== undefined) {
      const fee = toNumber(req.body.fee);
      if (fee == null || fee < 0) {
        return res.status(400).json({ success: false, error: 'Invalid delivery fee.' });
      }
      data.fee = fee;
    }
    if (req.body?.active !== undefined) data.active = Boolean(req.body.active);
    if (req.body?.sortOrder !== undefined) {
      data.sortOrder = toNumber(req.body.sortOrder) ?? 0;
    }
    const region = await prisma.deliveryRegion.update({
      where: { id: req.params.id },
      data,
    });
    res.json({ success: true, region });
  } catch (error) {
    console.error('Error updating delivery region:', error);
    res.status(500).json({ success: false, error: 'Failed to update delivery region.' });
  }
});

// DELETE
adminRouter.delete('/:id', async (req, res) => {
  try {
    const existing = await prisma.deliveryRegion.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { orders: true } } },
    });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Delivery region not found.' });
    }
    // Keep referential integrity: deactivate instead of deleting if orders exist
    if (existing._count.orders > 0) {
      await prisma.deliveryRegion.update({
        where: { id: req.params.id },
        data: { active: false },
      });
      return res.json({ success: true, deactivated: true });
    }
    await prisma.deliveryRegion.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting delivery region:', error);
    res.status(500).json({ success: false, error: 'Failed to delete delivery region.' });
  }
});

module.exports = { publicRouter, adminRouter };
