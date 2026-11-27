const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { sendOrderApprovalEmail, sendEmail } = require('../lib/email');
const { sendOrderApprovalSms, sendSms } = require('../lib/sms');
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
            currency: true, payoutMethod: true, promoCode: true, triggerType: true, threshold: true, scope: true,
          },
        },
        deliveryRegion: {
          select: { id: true, name: true, country: true, fee: true },
        },
      },
    });
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
            qualifiedRule: {
              select: {
                id: true, name: true, rewardType: true,
                rewardValue: true, currency: true, payoutMethod: true, promoCode: true,
              },
            },
          },
        }),
        statusChanged: true,
      };
    });
    const updatedOrder = result.order;
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
      const rule = updatedOrder.qualifiedRule;
      if (updatedOrder.rewardQualified && rule) {
        (async () => {
          try {
            const alreadySent = await prisma.rewardDispatch.findFirst({
              where: { orderId: updatedOrder.id, rewardRuleId: rule.id, status: 'SENT' },
              select: { id: true },
            });
            if (alreadySent) return;

            let message =
              `Dream More: Reward unlocked - ${rule.name}: ${rule.rewardValue}` +
              `${rule.promoCode ? ` (code ${rule.promoCode})` : ''}. Thank you for shopping with us!`;
            if (rule.rewardType === 'MOBILE_AIRTIME') {
              const amount = Number(rule.rewardValue) || 0;
              let voucher = amount > 0
                ? await prisma.airtimeVoucher.findFirst({
                    where: { status: 'AVAILABLE', amount },
                    orderBy: { createdAt: 'asc' },
                  })
                : null;
              if (!voucher) {
                voucher = await prisma.airtimeVoucher.findFirst({
                  where: { status: 'AVAILABLE' },
                  orderBy: { amount: 'asc' },
                });
              }
              if (voucher) {
                voucher = await prisma.airtimeVoucher.update({
                  where: { id: voucher.id },
                  data: {
                    status: 'USED',
                    assignedOrderId: updatedOrder.id,
                    usedAt: new Date(),
                  },
                });
                message =
                  `Dream More Airtime: You received ${Number(voucher.amount)} ETB ` +
                  `${voucher.network || 'mobile'} airtime! Recharge PIN: ${voucher.pinCode}. ` +
                  `Dial *805*${voucher.pinCode}# to redeem.`;
              }
            }

            const results = { sms: null, email: null };
            const errors = [];
            if (updatedOrder.customerPhone) {
              try {
                results.sms = await sendSms({ to: updatedOrder.customerPhone, message });
              } catch (e) {
                errors.push(`SMS: ${e.message}`);
                results.sms = { error: e.message };
              }
            }
            if (updatedOrder.customerEmail) {
              try {
                results.email = await sendEmail({
                  to: updatedOrder.customerEmail,
                  subject: 'Your Dream More Reward',
                  text: message,
                  html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;"><p>${message}</p></div>`,
                });
              } catch (e) {
                errors.push(`Email: ${e.message}`);
                results.email = { error: e.message };
              }
            }

            const anySent =
              (results.sms && !results.sms.error) ||
              (results.email && !results.email.error);
            await prisma.rewardDispatch.create({
              data: {
                rewardRuleId: rule.id,
                userId: updatedOrder.userId || null,
                orderId: updatedOrder.id,
                recipientEmail: updatedOrder.customerEmail,
                recipientPhone: updatedOrder.customerPhone,
                channel: 'BOTH',
                status: anySent ? 'SENT' : 'FAILED',
                message,
                error: errors.length ? errors.join('; ') : null,
                sentAt: anySent ? new Date() : null,
                sentBy: req.user?.id || null,
              },
            });
            console.log(
              `Order ${updatedOrder.orderNumber} reward dispatch ${anySent ? 'sent' : 'failed'}.`
            );
          } catch (dispatchError) {
            console.error(
              `Reward dispatch failed for order ${updatedOrder.orderNumber}:`,
              dispatchError
            );
          }
        })();
      }
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
router.patch('/:id/payment', requireAuth, requireAdmin, async (req, res) => {
  try {
    const action = normalizeText(req.body?.action).toLowerCase();
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({
        success: false,
        error: 'Action must be "approve" or "reject".',
      });
    }
    const note = normalizeText(req.body?.note).slice(0, 1000) || null;

    const order = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found.' });
    }
    const paymentStatus = action === 'approve' ? 'VERIFIED' : 'REJECTED';
    const updated = await prisma.order.update({
      where: { id: order.id },
      data: {
        paymentStatus,
        verificationMethod: 'ADMIN',
        verificationNotes: note
          ? `Admin ${action}${order.verificationNotes ? ` — prior: ${order.verificationNotes}` : ''} — ${note}`
          : `Manually ${action === 'approve' ? 'approved' : 'rejected'} by admin after reviewing uploaded payment file.`,
        verifiedAt: new Date(),
      },
    });
    return res.json({
      success: true,
      order: {
        ...updated,
        total: Number(updated.total),
        paymentStatus: updated.paymentStatus,
        transactionRef: updated.transactionRef,
        paymentScreenshotUrl: updated.paymentScreenshotUrl,
        verifiedAt: updated.verifiedAt,
      },
    });
  } catch (error) {
    console.error('Failed to update payment verification:', error);
    return res.status(500).json({ success: false, error: 'Failed to update payment verification' });
  }
});
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
      for (const item of order.items) {
        if (item.productId) {
          await transaction.product.updateMany({
            where: { id: item.productId },
            data: { stock: { increment: item.quantity } },
          });
        }
      }
      await transaction.order.delete({ where: { id: order.id } });
    });

    return res.json({ success: true });
  } catch (error) {
    console.error('Failed to delete order:', error);
    return res.status(500).json({ success: false, error: 'Failed to delete order' });
  }
});
module.exports = router;