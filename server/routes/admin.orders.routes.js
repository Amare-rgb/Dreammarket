const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { sendOrderApprovalEmail } = require('../lib/email');
const { sendOrderApprovalSms } = require('../lib/sms');

const router = express.Router();
const ORDER_STATUSES = [
  'CONFIRMED',
  'PROCESSING',
  'SHIPPED',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'CANCELLED',
];

const allowedTransitions = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'OUT_FOR_DELIVERY', 'CANCELLED'],
  SHIPPED: ['OUT_FOR_DELIVERY', 'DELIVERED'],
  OUT_FOR_DELIVERY: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
};

const normalizeText = (value) =>
  typeof value === 'string' ? value.trim() : '';

// GET ALL ORDERS (Admin)
router.get('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
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
            product: {
              select: { name: true, images: true },
            },
          },
        },
        rewardDispatches: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true, channel: true, status: true, message: true,
            sentAt: true, createdAt: true,
            rewardRule: { select: { id: true, name: true, rewardValue: true } },
          },
        },
        qualifiedRule: {
          select: {
            id: true, name: true, rewardType: true, rewardValue: true,
            promoCode: true, triggerType: true, threshold: true, scope: true,
          },
        },
        deliveryRegion: {
          select: { id: true, name: true, country: true, fee: true },
        },
      },
    });

    // ── Reward eligibility: cumulative spend per customer vs active rules ──
    const [activeRules, allOrders] = await Promise.all([
      prisma.rewardRule.findMany({
        where: { active: true, scope: 'ALL_ORDERS', triggerType: 'MIN_SPEND' },
      }),
      prisma.order.findMany({
        where: { status: { not: 'CANCELLED' } },
        select: { userId: true, customerEmail: true, total: true },
      }),
    ]);
    const spendByCustomer = new Map();
    for (const o of allOrders) {
      const key = o.userId || o.customerEmail.toLowerCase();
      spendByCustomer.set(key, (spendByCustomer.get(key) || 0) + Number(o.total));
    }

    res.json({
      success: true,
      orders: orders.map((order) => {
        const key = order.userId || order.customerEmail.toLowerCase();
        const totalSpend = spendByCustomer.get(key) || 0;
        const eligibleRewards = activeRules
          .map((r) => ({ rule: r, limit: Number(r.threshold ?? r.minSpend ?? 0) }))
          .filter(({ limit }) => limit > 0 && totalSpend >= limit)
          .map(({ rule: r, limit }) => ({
            id: r.id, name: r.name, minSpend: limit,
            rewardType: r.rewardType, rewardValue: r.rewardValue,
          }));
        return {
          ...order,
          total: Number(order.total),
          discountAmount: Number(order.discountAmount || 0),
          deliveryFee: order.deliveryFee != null ? Number(order.deliveryFee) : null,
          deliveryDistanceKm: order.deliveryDistanceKm ?? null,
          customerLat: order.customerLat ?? null,
          customerLng: order.customerLng ?? null,
          deliveryMapsUrl: order.deliveryMapsUrl ?? null,
          promoCode: order.promoCode ?? null,
          customerTotalSpend: Math.round(totalSpend * 100) / 100,
          eligibleRewards,
          items: order.items.map((item) => ({
            ...item,
            productName: item.productName || item.product?.name || 'Product name unavailable',
            unitPrice: Number(item.unitPrice),
            image: item.product?.images?.[0] || null,
          })),
        };
      }),
    });
  } catch (error) {
    console.error('Failed to fetch admin orders:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch orders' });
  }
});

// UPDATE ORDER STATUS (Approve / Cancel)
router.patch('/:id/status', requireAuth, requireAdmin, async (req, res) => {
  try {
    const nextStatus = normalizeText(req.body?.status).toUpperCase();
    if (!ORDER_STATUSES.includes(nextStatus)) {
      return res.status(400).json({
        success: false,
        error: 'Choose a valid order status.',
      });
    }

    const result = await prisma.$transaction(async (transaction) => {
      const order = await transaction.order.findUnique({
        where: { id: req.params.id },
        include: { items: true },
      });
      if (!order) {
        const error = new Error('Order not found.');
        error.statusCode = 404;
        throw error;
      }
      if (order.status === nextStatus) {
        return { order, statusChanged: false };
      }
      if (!allowedTransitions[order.status]?.includes(nextStatus)) {
        const error = new Error(
          `An order cannot move from ${order.status} to ${nextStatus}.`
        );
        error.statusCode = 409;
        throw error;
      }

      const updated = await transaction.order.updateMany({
        where: { id: order.id, status: order.status },
        data: { status: nextStatus },
      });
      if (!updated.count) {
        const error = new Error('The order changed; refresh and try again.');
        error.statusCode = 409;
        throw error;
      }

      // Restore stock if cancelled
      if (nextStatus === 'CANCELLED') {
        for (const item of order.items) {
          if (item.productId) {
            await transaction.product.updateMany({
              where: { id: item.productId },
              data: { stock: { increment: item.quantity } },
            });
          }
        }
      }

      return {
        order: await transaction.order.findUnique({
          where: { id: order.id },
          include: {
            items: {
              include: {
                product: { select: { name: true, images: true } },
              },
            },
          },
        }),
        statusChanged: true,
      };
    });

    const updatedOrder = result.order;

    // ✅ SEND EMAIL + SMS IF CONFIRMED — fire-and-forget so a slow or
    // unreachable provider (e.g. Africa's Talking timeout) never blocks
    // the order status update response.
    if (result.statusChanged && nextStatus === 'CONFIRMED') {
      sendOrderApprovalEmail(updatedOrder)
        .then(() => console.log(`Order ${updatedOrder.orderNumber} approval email sent.`))
        .catch((notificationError) =>
          console.error(
            `Order ${updatedOrder.orderNumber} was confirmed, but the customer approval email failed:`,
            notificationError
          )
        );

      sendOrderApprovalSms(updatedOrder)
        .then(() => console.log(`Order ${updatedOrder.orderNumber} approval SMS sent.`))
        .catch((smsError) =>
          console.error(
            `Order ${updatedOrder.orderNumber} was confirmed, but the customer approval SMS failed:`,
            smsError
          )
        );
    }

    return res.json({
      success: true,
      order: {
        ...updatedOrder,
        total: Number(updatedOrder.total),
        items: updatedOrder.items.map((item) => ({
          ...item,
          productName: item.productName || item.product?.name || 'Product name unavailable',
          unitPrice: Number(item.unitPrice),
          image: item.product?.images?.[0] || null,
        })),
      },
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, error: error.message });
    }
    console.error('Failed to update order status:', error);
    return res.status(500).json({ success: false, error: 'Failed to update order status' });
  }
});

// DELETE ORDER (Admin)
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: { items: true },
    });
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found.' });
    }

    await prisma.$transaction(async (transaction) => {
      // Restore stock for every item that still references a product
      for (const item of order.items) {
        if (item.productId) {
          await transaction.product.updateMany({
            where: { id: item.productId },
            data: { stock: { increment: item.quantity } },
          });
        }
      }
      // OrderItem rows cascade-delete with the order
      await transaction.order.delete({ where: { id: order.id } });
    });

    return res.json({ success: true });
  } catch (error) {
    console.error('Failed to delete order:', error);
    return res.status(500).json({ success: false, error: 'Failed to delete order' });
  }
});

module.exports = router;