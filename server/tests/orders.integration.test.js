/**
 * Integration tests for the customer orders API (routes/orders.routes.js).
 * Express + supertest with the Prisma layer fully mocked — no database needed.
 */

// middleware/auth.js reads JWT_SECRET at require time
process.env.JWT_SECRET =
  'test-secret-key-that-is-long-enough-32chars!!';

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

// ── Prisma mock ──────────────────────────────────────────────
const mockPrisma = {
  user: { findUnique: jest.fn() },
  order: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
  },
  product: {
    findMany: jest.fn(),
    updateMany: jest.fn(),
  },
  $transaction: jest.fn(),
};

jest.mock('../lib/prisma', () => mockPrisma);

const ordersRouter = require('../routes/orders.routes');

const app = express();
app.use(express.json());
app.use('/api/orders', ordersRouter);

const SECRET = process.env.JWT_SECRET;
const authToken = (overrides = {}) =>
  'Bearer ' +
  jwt.sign(
    { userId: 'user-1', email: 'customer@example.com', role: 'USER', ...overrides },
    SECRET,
    { expiresIn: '1h' }
  );

const sampleOrder = {
  id: 'order-1',
  orderNumber: 'ORD-123-4567',
  status: 'PENDING',
  paymentMethod: 'CASH_ON_DELIVERY',
  paymentProofUrl: null,
  total: 250,
  createdAt: new Date().toISOString(),
  shippingAddress: 'Addis Ababa, Bole',
  customerName: 'Test Customer',
  customerPhone: '+251900000000',
  note: null,
  items: [
    {
      id: 'item-1',
      productId: 'prod-1',
      productName: 'Sample Product',
      sku: 'SKU-1',
      quantity: 2,
      unitPrice: 125,
      product: { images: ['https://example.com/img.png'] },
    },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.user.findUnique.mockResolvedValue({
    email: 'customer@example.com',
  });
});

describe('GET /api/orders', () => {
  it('rejects requests without a token', async () => {
    const res = await request(app).get('/api/orders');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('rejects an invalid token', async () => {
    const res = await request(app)
      .get('/api/orders')
      .set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
  });

  it('returns the customer orders with mapped items', async () => {
    mockPrisma.order.findMany.mockResolvedValue([sampleOrder]);

    const res = await request(app)
      .get('/api/orders')
      .set('Authorization', authToken());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.orders).toHaveLength(1);
    expect(res.body.orders[0].orderNumber).toBe('ORD-123-4567');
    expect(res.body.orders[0].total).toBe(250);
    expect(res.body.orders[0].items[0].image).toBe(
      'https://example.com/img.png'
    );
    expect(res.body.orders[0].items[0].unitPrice).toBe(125);
  });

  it('returns an empty list when the customer has no orders', async () => {
    mockPrisma.order.findMany.mockResolvedValue([]);
    const res = await request(app)
      .get('/api/orders')
      .set('Authorization', authToken());
    expect(res.status).toBe(200);
    expect(res.body.orders).toEqual([]);
  });
});

describe('GET /api/orders/:orderNumber', () => {
  it('returns a single order for the owner', async () => {
    mockPrisma.order.findFirst.mockResolvedValue(sampleOrder);

    const res = await request(app)
      .get('/api/orders/ORD-123-4567')
      .set('Authorization', authToken());

    expect(res.status).toBe(200);
    expect(res.body.order.orderNumber).toBe('ORD-123-4567');
    expect(mockPrisma.order.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          orderNumber: 'ORD-123-4567',
          customerEmail: { equals: 'customer@example.com', mode: 'insensitive' },
        }),
      })
    );
  });

  it('returns 404 when the order does not exist', async () => {
    mockPrisma.order.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/orders/ORD-UNKNOWN')
      .set('Authorization', authToken());

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

describe('POST /api/orders', () => {
  const validBody = {
    customerName: 'Test Customer',
    customerPhone: '+251900000000',
    shippingAddress: 'Addis Ababa, Bole',
    note: '',
    paymentMethod: 'CASH_ON_DELIVERY',
    items: [{ productId: 'prod-1', quantity: 2 }],
  };

  it('rejects an empty order', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', authToken())
      .send({ ...validBody, items: [] });
    expect(res.status).toBe(400);
  });

  it('rejects an unsupported payment method', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', authToken())
      .send({ ...validBody, paymentMethod: 'CARD' });
    expect(res.status).toBe(400);
  });

  it('rejects an invalid payment proof URL', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', authToken())
      .send({
        ...validBody,
        paymentProofUrl: 'https://evil.example.com/fake.png',
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/payment information/i);
  });

  it('creates an order and decrements stock inside a transaction', async () => {
    mockPrisma.product.findMany.mockResolvedValue([
      { id: 'prod-1', name: 'Sample Product', sku: 'SKU-1', price: 200, discountPrice: 125 },
    ]);
    mockPrisma.product.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.order.create.mockResolvedValue({
      ...sampleOrder,
      items: [
        {
          ...sampleOrder.items[0],
          product: { images: ['https://example.com/img.png'] },
        },
      ],
    });
    mockPrisma.$transaction.mockImplementation(async (callback) =>
      callback(mockPrisma)
    );

    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', authToken())
      .send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.order.orderNumber).toBe('ORD-123-4567');
    // discounted price (125) × quantity (2) = 250
    expect(res.body.order.total).toBe(250);
    expect(mockPrisma.product.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'prod-1', stock: { gte: 2 } },
        data: { stock: { decrement: 2 } },
      })
    );
  });

  it('fails with 409 when stock is insufficient', async () => {
    mockPrisma.product.findMany.mockResolvedValue([
      { id: 'prod-1', name: 'Sample Product', sku: 'SKU-1', price: 200, discountPrice: null },
    ]);
    mockPrisma.product.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.$transaction.mockImplementation(async (callback) =>
      callback(mockPrisma)
    );

    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', authToken())
      .send(validBody);

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/stock/i);
  });
});
