// routes/orders.routes.js
const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const normalizeText = (value) => typeof value === 'string' ? value.trim() : '';

// ── Helpers: distance & delivery fee ─────────────────────────
const toNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

// Haversine distance in km
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Calculate delivery fee from Settings (tiers or base+perKm)
async function calculateDeliveryFee(distanceKm, orderTotal) {
  const settings = await prisma.settings.findFirst({
    orderBy: { updatedAt: 'desc' },
  });
  if (!settings) return { fee: 0, distanceKm: null };

  const freeAbove = toNumber(settings.freeDeliveryAbove);
  if (freeAbove != null && orderTotal >= freeAbove) {
    return { fee: 0, distanceKm };
  }

  const tiers = Array.isArray(settings.deliveryTiers)
    ? settings.deliveryTiers
    : [];
  const validTiers = tiers
    .map((t) => ({
      minKm: toNumber(t?.minKm) ?? 0,
      maxKm: toNumber(t?.maxKm),
      fee: toNumber(t?.fee),
    }))
    .filter((t) => t.fee != null)
    .sort((a, b) => a.minKm - b.minKm);

  if (validTiers.length > 0 && distanceKm != null) {
    const tier = validTiers.find(
      (t) => distanceKm >= t.minKm && (t.maxKm == null || distanceKm < t.maxKm)
    );
    if (tier) return { fee: tier.fee, distanceKm };
    // Beyond last tier: use last tier fee
    return { fee: validTiers[validTiers.length - 1].fee, distanceKm };
  }

  const baseFee = toNumber(settings.deliveryBaseFee) ?? 0;
  const perKm = toNumber(settings.deliveryPerKmRate) ?? 0;
  const fee = baseFee + (distanceKm != null ? perKm * distanceKm : 0);
  return { fee: Math.round(fee * 100) / 100, distanceKm };
}

// Validate a promo code and return discount amount
async function validatePromoCode(code, orderTotal) {
  const promo = await prisma.promoCode.findUnique({
    where: { code: code.toUpperCase() },
  });
  if (!promo || !promo.active) {
    return { error: 'This promo code is not valid.' };
  }
  if (promo.expiresAt && new Date(promo.expiresAt) < new Date()) {
    return { error: 'This promo code has expired.' };
  }
  if (promo.usageLimit != null && promo.usedCount >= promo.usageLimit) {
    return { error: 'This promo code has reached its usage limit.' };
  }
  const minTotal = toNumber(promo.minOrderTotal);
  if (minTotal != null && orderTotal < minTotal) {
    return {
      error: `This promo code requires a minimum order of ${minTotal}.`,
    };
  }
  const value = Number(promo.discountValue);
  let discount =
    promo.discountType === 'PERCENT'
      ? (orderTotal * value) / 100
      : value;
  discount = Math.min(discount, orderTotal);
  return { promo, discount: Math.round(discount * 100) / 100 };
}

router.get('/', requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { email: true },
    });
    if (!user) {
      return res.status(401).json({ success: false, error: 'User not found.' });
    }

    const orders = await prisma.order.findMany({
      where: { customerEmail: { equals: user.email, mode: 'insensitive' } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      include: {
        items: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            productId: true,
            productName: true,
            sku: true,
            quantity: true,
            unitPrice: true,
            product: { select: { images: true } },
          },
        },
        qualifiedRule: {
          select: {
            id: true,
            name: true,
            rewardType: true,
            rewardValue: true,
            promoCode: true,
          },
        },
      },
    });

    return res.json({
      success: true,
      orders: orders.map((order) => ({
        ...order,
        total: Number(order.total),
        items: order.items.map((item) => ({
          ...item,
          unitPrice: Number(item.unitPrice),
          image: item.product?.images?.[0] || null,
        })),
      })),
    });
  } catch (error) {
    console.error('Failed to fetch customer orders:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch orders.' });
  }
});

// GET /api/orders/delivery-quote?lat=..&lng=..&subtotal=.. — real-time delivery fee
router.get('/delivery-quote', requireAuth, async (req, res) => {
  try {
    const lat = toNumber(req.query?.lat);
    const lng = toNumber(req.query?.lng);
    const subtotal = toNumber(req.query?.subtotal) ?? 0;

    const settings = await prisma.settings.findFirst({
      orderBy: { updatedAt: 'desc' },
    });
    const storeLat = toNumber(settings?.storeLatitude);
    const storeLng = toNumber(settings?.storeLongitude);

    if (
      lat == null || lng == null ||
      storeLat == null || storeLng == null ||
      Math.abs(lat) > 90 || Math.abs(lng) > 180
    ) {
      return res.json({
        success: true,
        configured: false,
        fee: 0,
        distanceKm: null,
      });
    }

    const distanceKm = Math.round(haversineKm(storeLat, storeLng, lat, lng) * 100) / 100;
    const { fee } = await calculateDeliveryFee(distanceKm, subtotal);

    return res.json({
      success: true,
      configured: true,
      fee,
      distanceKm,
      mapsUrl: `https://www.google.com/maps?q=${lat},${lng}`,
    });
  } catch (error) {
    console.error('Failed to calculate delivery quote:', error);
    return res.status(500).json({ success: false, error: 'Failed to calculate delivery fee.' });
  }
});

// GET /api/orders/:orderNumber — single order for the authenticated customer
router.get('/:orderNumber', requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { email: true },
    });
    if (!user) {
      return res.status(401).json({ success: false, error: 'User not found.' });
    }

    const order = await prisma.order.findFirst({
      where: {
        orderNumber: req.params.orderNumber,
        customerEmail: { equals: user.email, mode: 'insensitive' },
      },
      include: {
        items: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            productId: true,
            productName: true,
            sku: true,
            quantity: true,
            unitPrice: true,
            product: { select: { images: true } },
          },
        },
        qualifiedRule: {
          select: {
            id: true,
            name: true,
            rewardType: true,
            rewardValue: true,
            promoCode: true,
          },
        },
      },
    });

    if (!order) {
      return res
        .status(404)
        .json({ success: false, error: 'Order not found.' });
    }

    return res.json({
      success: true,
      order: {
        ...order,
        total: Number(order.total),
        items: order.items.map((item) => ({
          ...item,
          unitPrice: Number(item.unitPrice),
          image: item.product?.images?.[0] || null,
        })),
      },
    });
  } catch (error) {
    console.error('Failed to fetch customer order:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch order.' });
  }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const customerName = normalizeText(req.body?.customerName);
    const customerPhone = normalizeText(req.body?.customerPhone);
    const shippingAddress = normalizeText(req.body?.shippingAddress);
    const note = normalizeText(req.body?.note);
    const paymentMethod = normalizeText(req.body?.paymentMethod);
    const paymentProofUrl = normalizeText(req.body?.paymentProofUrl);
    const promoCode = normalizeText(req.body?.promoCode).toUpperCase();
    const rawItems = Array.isArray(req.body?.items) ? req.body.items : [];
    const customerLat = toNumber(req.body?.customerLat);
    const customerLng = toNumber(req.body?.customerLng);
    const gpsAccuracy = toNumber(req.body?.gpsAccuracy);
    const geoAddress = normalizeText(req.body?.geoAddress).slice(0, 1000);
    const landmark = normalizeText(req.body?.landmark).slice(0, 300);
    const deliveryRegionId = normalizeText(req.body?.deliveryRegionId) || null;
    let validatedPaymentProofUrl = null;

    if (paymentProofUrl) {
      try {
        const proofUrl = new URL(paymentProofUrl);
        const requestOrigin = `${req.protocol}://${req.get('host')}`;
        if (
          paymentProofUrl.length > 2048 ||
          proofUrl.origin !== requestOrigin ||
          !proofUrl.pathname.startsWith('/uploads/payments/')
        ) {
          throw new Error('Invalid payment proof URL');
        }
        validatedPaymentProofUrl = paymentProofUrl;
      } catch {
        return res.status(400).json({
          success: false,
          error: 'Upload a valid payment information file.',
        });
      }
    }

    if (
      !customerName || customerName.length > 160 ||
      !customerPhone || customerPhone.length > 40 ||
      !shippingAddress || shippingAddress.length > 1000 ||
      note.length > 4000 ||
      paymentMethod !== 'CASH_ON_DELIVERY' ||
      rawItems.length === 0 || rawItems.length > 100
    ) {
      return res.status(400).json({
        success: false,
        error: 'Provide valid contact, delivery, payment, and product details.',
      });
    }

    // ── Location: verified GPS OR admin-defined delivery region ──
    const hasValidGps =
      customerLat != null && customerLng != null &&
      Math.abs(customerLat) <= 90 && Math.abs(customerLng) <= 180 &&
      (gpsAccuracy == null || gpsAccuracy <= 500);
    if (!hasValidGps && !deliveryRegionId) {
      return res.status(400).json({
        success: false,
        error: 'Please detect your exact location or select a delivery region before placing the order.',
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, email: true },
    });
    if (!user) {
      return res.status(401).json({ success: false, error: 'User not found.' });
    }

    const quantities = new Map();
    for (const item of rawItems) {
      const productId = normalizeText(item?.productId);
      const quantity = Number(item?.quantity);
      if (!productId || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 999) {
        return res.status(400).json({
          success: false,
          error: 'Each item must have a valid product and quantity from 1 to 999.',
        });
      }
      const nextQuantity = (quantities.get(productId) || 0) + quantity;
      if (nextQuantity > 999) {
        return res.status(400).json({
          success: false,
          error: 'The total quantity of a product cannot exceed 999.',
        });
      }
      quantities.set(productId, nextQuantity);
    }

    // Generate unique order number before transaction to avoid race conditions
    // Using timestamp + random component for uniqueness while maintaining readability
    const timestamp = Date.now();
    const randomSuffix = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const orderNumber = `${timestamp}${randomSuffix}`;

    const order = await prisma.$transaction(async (transaction) => {
      const products = await transaction.product.findMany({
        where: { id: { in: [...quantities.keys()] } },
        select: { id: true, name: true, sku: true, price: true, discountPrice: true, stock: true },
      });

      if (products.length !== quantities.size) {
        const error = new Error('One or more selected products no longer exist.');
        error.statusCode = 400;
        throw error;
      }

      const orderItems = [];
      for (const product of products) {
        const quantity = quantities.get(product.id);
        const newStock = (product.stock || 0) - quantity;
        const wentOutOfStock = newStock <= 0;
        const changed = await transaction.product.updateMany({
          where: { id: product.id, stock: { gte: quantity } },
          data: {
            stock: { decrement: quantity },
            ...(wentOutOfStock
              ? {
                  availabilityStatus: 'OUT_OF_STOCK_TEMPORARY',
                  outOfStockAt: new Date(),
                }
              : {}),
          },
        });
        if (changed.count !== 1) {
          const error = new Error(`${product.name} does not have enough stock for this order.`);
          error.statusCode = 409;
          throw error;
        }

        const discountedPrice = Number(product.discountPrice);
        const unitPrice = discountedPrice > 0 ? discountedPrice : Number(product.price);
        orderItems.push({
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          quantity,
          unitPrice,
        });
      }

      const subtotal = orderItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

      // ── Promo code discount ──
      let discountAmount = 0;
      let appliedPromo = null;
      if (promoCode) {
        const promoResult = await transaction.promoCode.findUnique({
          where: { code: promoCode },
        });
        if (!promoResult || !promoResult.active) {
          const error = new Error('This promo code is not valid.');
          error.statusCode = 400;
          throw error;
        }
        if (promoResult.expiresAt && new Date(promoResult.expiresAt) < new Date()) {
          const error = new Error('This promo code has expired.');
          error.statusCode = 400;
          throw error;
        }
        if (promoResult.usageLimit != null && promoResult.usedCount >= promoResult.usageLimit) {
          const error = new Error('This promo code has reached its usage limit.');
          error.statusCode = 400;
          throw error;
        }
        const minTotal = toNumber(promoResult.minOrderTotal);
        if (minTotal != null && subtotal < minTotal) {
          const error = new Error(`This promo code requires a minimum order of ${minTotal}.`);
          error.statusCode = 400;
          throw error;
        }
        const value = Number(promoResult.discountValue);
        discountAmount =
          promoResult.discountType === 'PERCENT'
            ? (subtotal * value) / 100
            : value;
        discountAmount = Math.min(Math.round(discountAmount * 100) / 100, subtotal);
        appliedPromo = promoResult;
      }

      // ── Delivery fee: verified GPS distance OR region flat fee ──
      let deliveryFee = 0;
      let deliveryDistanceKm = null;
      let deliveryMapsUrl = null;
      let selectedRegion = null;
      const settings = await transaction.settings.findFirst({
        orderBy: { updatedAt: 'desc' },
      });
      const storeLat = toNumber(settings?.storeLatitude);
      const storeLng = toNumber(settings?.storeLongitude);
      const hasCoords =
        hasValidGps &&
        storeLat != null &&
        storeLng != null &&
        Math.abs(storeLat) <= 90 &&
        Math.abs(storeLng) <= 180;
      if (hasCoords) {
        deliveryDistanceKm = Math.round(haversineKm(storeLat, storeLng, customerLat, customerLng) * 100) / 100;
        // Geofence: reject coordinates outside the allowed delivery radius
        const maxRadius = toNumber(settings?.maxDeliveryRadiusKm);
        if (maxRadius != null && maxRadius > 0 && deliveryDistanceKm > maxRadius) {
          const error = new Error(
            `This location is outside our delivery area (max ${maxRadius} km from the store).`
          );
          error.statusCode = 400;
          throw error;
        }
        const feeResult = await calculateDeliveryFee(deliveryDistanceKm, subtotal - discountAmount);
        deliveryFee = feeResult.fee;
        deliveryMapsUrl = `https://www.google.com/maps?q=${customerLat},${customerLng}`;
      } else if (deliveryRegionId) {
        // Region fallback: flat fee set by admin
        selectedRegion = await transaction.deliveryRegion.findFirst({
          where: { id: deliveryRegionId, active: true },
        });
        if (!selectedRegion) {
          const error = new Error('Selected delivery region is not available.');
          error.statusCode = 400;
          throw error;
        }
        deliveryFee = Number(selectedRegion.fee) || 0;
      }

      const total = Math.max(0, subtotal - discountAmount) + deliveryFee;

      // ── Automatic reward qualification ──
      const productIds = [...quantities.keys()];
      const activeRules = await transaction.rewardRule.findMany({
        where: {
          active: true,
          OR: [
            { scope: 'ALL_ORDERS' },
            { scope: 'PRODUCT', productId: { in: productIds } },
          ],
        },
        orderBy: { createdAt: 'asc' },
      });

      const totalQty = orderItems.reduce((s, i) => s + i.quantity, 0);
      let qualifiedRule = null;
      let bestScore = -1;
      for (const rule of activeRules) {
        const threshold = Number(rule.threshold ?? rule.minSpend ?? 0);
        if (!(threshold > 0)) continue;
        let met = false;
        if (rule.scope === 'PRODUCT') {
          const item = orderItems.find((i) => i.productId === rule.productId);
          if (!item) continue;
          const itemSpend = item.unitPrice * item.quantity;
          met =
            rule.triggerType === 'MIN_QUANTITY'
              ? item.quantity >= threshold
              : itemSpend >= threshold;
        } else {
          met =
            rule.triggerType === 'MIN_QUANTITY'
              ? totalQty >= threshold
              : subtotal >= threshold;
        }
        if (met && threshold > bestScore) {
          bestScore = threshold;
          qualifiedRule = rule;
        }
      }

      const created = await transaction.order.create({
        data: {
          orderNumber,
          customerName,
          customerEmail: user.email,
          customerPhone,
          shippingAddress,
          note: note || null,
          paymentMethod,
          paymentProofUrl: validatedPaymentProofUrl,
          userId: user.id,
          promoCode: appliedPromo ? appliedPromo.code : null,
          discountAmount: discountAmount.toFixed(2),
          deliveryFee: deliveryFee.toFixed(2),
          deliveryDistanceKm,
          customerLat: hasCoords ? customerLat : null,
          customerLng: hasCoords ? customerLng : null,
          deliveryMapsUrl,
          gpsAccuracy: hasCoords ? gpsAccuracy : null,
          geoAddress: hasCoords ? geoAddress || null : null,
          landmark: landmark || null,
          deliveryVerified: hasCoords,
          deliveryRegionId: selectedRegion?.id || null,
          total: total.toFixed(2),
          rewardQualified: Boolean(qualifiedRule),
          qualifiedRuleId: qualifiedRule?.id || null,
          items: { create: orderItems },
        },
        include: {
          items: {
            include: { product: { select: { images: true } } },
          },
        },
      });

      // Increment promo usage
      if (appliedPromo) {
        await transaction.promoCode.update({
          where: { id: appliedPromo.id },
          data: { usedCount: { increment: 1 } },
        });
      }

      return created;
    });

    return res.status(201).json({
      success: true,
      order: {
        ...order,
        total: Number(order.total),
        items: order.items.map((item) => ({
          ...item,
          unitPrice: Number(item.unitPrice),
          image: item.product?.images?.[0] || null,
        })),
      },
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, error: error.message });
    }
    console.error('Failed to create customer order:', error);
    return res.status(500).json({ success: false, error: 'Failed to create order.' });
  }
});

// POST /api/orders/validate-promo { code, subtotal }
router.post('/validate-promo', requireAuth, async (req, res) => {
  try {
    const code = normalizeText(req.body?.code).toUpperCase();
    const subtotal = toNumber(req.body?.subtotal) ?? 0;
    if (!code) {
      return res.status(400).json({ success: false, error: 'Enter a promo code.' });
    }
    const result = await validatePromoCode(code, subtotal);
    if (result.error) {
      return res.status(400).json({ success: false, error: result.error });
    }
    return res.json({
      success: true,
      code: result.promo.code,
      discount: result.discount,
      discountType: result.promo.discountType,
    });
  } catch (error) {
    console.error('Failed to validate promo code:', error);
    return res.status(500).json({ success: false, error: 'Failed to validate promo code.' });
  }
});

module.exports = router;