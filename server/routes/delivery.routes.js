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

publicRouter.get('/', async (req, res) => {
  try {
    const regions = await prisma.deliveryRegion.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        country: true,
        region: true,
        woreda: true,
        kebele: true,
        landmark: true,
        latitude: true,
        longitude: true,
        fee: true,
      },
    });
    res.json({ success: true, regions });
  } catch (error) {
    console.error('Error fetching delivery regions:', error);
    res.status(500).json({ success: false, error: 'Failed to load delivery regions.' });
  }
});
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

publicRouter.get('/nearest', async (req, res) => {
  try {
    const lat = toNumber(req.query.lat);
    const lng = toNumber(req.query.lng);
    if (lat == null || lng == null || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      return res.status(400).json({
        success: false,
        error: 'Provide valid lat and lng query parameters.',
      });
    }

    const regions = await prisma.deliveryRegion.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        country: true,
        region: true,
        woreda: true,
        kebele: true,
        landmark: true,
        latitude: true,
        longitude: true,
        fee: true,
      },
    });

    const etaHours = (distanceKm) =>
      distanceKm == null ? null : Math.max(1, Math.ceil(distanceKm / 25));

    const located = regions
      .filter((r) => r.latitude != null && r.longitude != null)
      .map((r) => {
        const distanceKm =
          Math.round(
            haversineKm(lat, lng, Number(r.latitude), Number(r.longitude)) * 10
          ) / 10;
        return {
          ...r,
          distanceKm,
          exactMatch: distanceKm <= 1.5,
          etaHours: etaHours(distanceKm),
        };
      })
      .sort((a, b) => a.distanceKm - b.distanceKm);

    const unlocated = regions.filter(
      (r) => r.latitude == null || r.longitude == null
    );

    res.json({
      success: true,
      nearest: located[0] || null,
      locations: [...located, ...unlocated.map((r) => ({ ...r, distanceKm: null, exactMatch: false, etaHours: null }))],
    });
  } catch (error) {
    console.error('Error computing nearest delivery region:', error);
    res.status(500).json({ success: false, error: 'Failed to locate nearest region.' });
  }
});

adminRouter.use(requireAuth, requireAdmin);

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
    const lat = toNumber(req.body?.latitude);
    const lng = toNumber(req.body?.longitude);
    if ((lat != null && (lat < -90 || lat > 90)) || (lng != null && (lng < -180 || lng > 180))) {
      return res.status(400).json({ success: false, error: 'Invalid coordinates.' });
    }
    const region = await prisma.deliveryRegion.create({
      data: {
        name,
        country: normalizeText(req.body?.country).slice(0, 120) || 'Ethiopia',
        region: normalizeText(req.body?.region).slice(0, 120) || null,
        woreda: normalizeText(req.body?.woreda).slice(0, 120) || null,
        kebele: normalizeText(req.body?.kebele).slice(0, 120) || null,
        landmark: normalizeText(req.body?.landmark).slice(0, 300) || null,
        latitude: lat,
        longitude: lng,
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
      data.country = normalizeText(req.body.country).slice(0, 120) || 'Ethiopia';
    }
    for (const field of ['region', 'woreda', 'kebele']) {
      if (req.body?.[field] !== undefined) {
        data[field] = normalizeText(req.body[field]).slice(0, 120) || null;
      }
    }
    if (req.body?.landmark !== undefined) {
      data.landmark = normalizeText(req.body.landmark).slice(0, 300) || null;
    }
    if (req.body?.latitude !== undefined || req.body?.longitude !== undefined) {
      const lat = toNumber(req.body.latitude);
      const lng = toNumber(req.body.longitude);
      if ((lat != null && (lat < -90 || lat > 90)) || (lng != null && (lng < -180 || lng > 180))) {
        return res.status(400).json({ success: false, error: 'Invalid coordinates.' });
      }
      data.latitude = lat;
      data.longitude = lng;
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
