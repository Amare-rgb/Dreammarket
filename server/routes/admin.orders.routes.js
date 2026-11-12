const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { sendOrderApprovalEmail } = require('../lib/email');
const { sendOrderApprovalSms } = require('../lib/sms');

const router = express.Router();
const ORDER_STATUSES = ['CONFIRMED', 'CANCELLED'];

const allowedTransitions = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
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
      },
    });

    res.json({
      success: true,
      orders: orders.map((order) => ({
        ...order,
        total: Number(order.total),
        items: order.items.map((item) => ({
          ...item,
          productName: item.productName || item.product?.name || 'Product name unavailable',
          unitPrice: Number(item.unitPrice),
          image: item.product?.images?.[0] || null,
        })),
      })),
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
    let notificationSent = null;
    let smsSent = null;

    // ✅ SEND EMAIL IF CONFIRMED
    if (result.statusChanged && nextStatus === 'CONFIRMED') {
      try {
        await sendOrderApprovalEmail(updatedOrder);
        notificationSent = true;
      } catch (notificationError) {
        notificationSent = false;
        console.error(
          `Order ${updatedOrder.orderNumber} was confirmed, but the customer approval email failed:`,
          notificationError
        );
      }

      // ✅ SEND SMS IF CONFIRMED
      try {
        await sendOrderApprovalSms(updatedOrder);
        smsSent = true;
      } catch (smsError) {
        smsSent = false;
        console.error(
          `Order ${updatedOrder.orderNumber} was confirmed, but the customer approval SMS failed:`,
          smsError
        );
      }
    }

    return res.json({
      success: true,
      notificationSent,
      smsSent,
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