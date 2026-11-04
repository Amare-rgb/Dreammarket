const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const normalizeText = (value) =>
  typeof value === 'string' ? value.trim() : '';

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
            product: {
              select: {
                images: true,
              },
            },
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

router.post('/', requireAuth, async (req, res) => {
  try {
    const customerName = normalizeText(req.body?.customerName);
    const customerPhone = normalizeText(req.body?.customerPhone);
    const shippingAddress = normalizeText(req.body?.shippingAddress);
    const note = normalizeText(req.body?.note);
    const paymentMethod = normalizeText(req.body?.paymentMethod);
    const paymentProofUrl = normalizeText(req.body?.paymentProofUrl);
    const rawItems = Array.isArray(req.body?.items) ? req.body.items : [];
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
      !customerName ||
      customerName.length > 160 ||
      !customerPhone ||
      customerPhone.length > 40 ||
      !shippingAddress ||
      shippingAddress.length > 1000 ||
      note.length > 4000 ||
      paymentMethod !== 'CASH_ON_DELIVERY' ||
      rawItems.length === 0 ||
      rawItems.length > 100
    ) {
      return res.status(400).json({
        success: false,
        error: 'Provide valid contact, delivery, payment, and product details.',
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { email: true },
    });
    if (!user) {
      return res.status(401).json({ success: false, error: 'User not found.' });
    }

    const quantities = new Map();
    for (const item of rawItems) {
      const productId = normalizeText(item?.productId);
      const quantity = Number(item?.quantity);
      if (
        !productId ||
        !Number.isSafeInteger(quantity) ||
        quantity < 1 ||
        quantity > 999
      ) {
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

    const order = await prisma.$transaction(async (transaction) => {
      const products = await transaction.product.findMany({
        where: { id: { in: [...quantities.keys()] } },
        select: {
          id: true,
          name: true,
          sku: true,
          price: true,
          discountPrice: true,
        },
      });

      if (products.length !== quantities.size) {
        const error = new Error('One or more selected products no longer exist.');
        error.statusCode = 400;
        throw error;
      }

      const orderItems = [];
      for (const product of products) {
        const quantity = quantities.get(product.id);
        const changed = await transaction.product.updateMany({
          where: { id: product.id, stock: { gte: quantity } },
          data: { stock: { decrement: quantity } },
        });
        if (changed.count !== 1) {
          const error = new Error(
            `${product.name} does not have enough stock for this order.`
          );
          error.statusCode = 409;
          throw error;
        }

        const discountedPrice = Number(product.discountPrice);
        const unitPrice =
          discountedPrice > 0 ? discountedPrice : Number(product.price);
        orderItems.push({
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          quantity,
          unitPrice,
        });
      }

      const total = orderItems.reduce(
        (sum, item) => sum + item.unitPrice * item.quantity,
        0
      );
      const [nextOrderNumber] = await transaction.$queryRaw`
        SELECT nextval('"orders_order_number_seq"') AS value
      `;
      const orderNumber = String(nextOrderNumber.value);

      return transaction.order.create({
        data: {
          orderNumber,
          customerName,
          customerEmail: user.email,
          customerPhone,
          shippingAddress,
          note: note || null,
          paymentMethod,
          paymentProofUrl: validatedPaymentProofUrl,
          total: total.toFixed(2),
          items: { create: orderItems },
        },
        include: {
          items: {
            include: {
              product: {
                select: {
                  images: true,
                },
              },
            },
          },
        },
      });
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
      return res
        .status(error.statusCode)
        .json({ success: false, error: error.message });
    }
    console.error('Failed to create customer order:', error);
    return res.status(500).json({ success: false, error: 'Failed to create order.' });
  }
});

module.exports = router;
