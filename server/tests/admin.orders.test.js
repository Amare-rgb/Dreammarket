process.env.JWT_SECRET = 'test-secret-key-that-is-long-enough-32chars!!';
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

const mockPrisma = {
  order: { findMany: jest.fn(), findUnique: jest.fn(), updateMany: jest.fn() },
  product: { updateMany: jest.fn() },
  $transaction: jest.fn(),
};

jest.mock('../lib/prisma', () => mockPrisma);
jest.mock('../lib/email', () => ({ sendOrderApprovalEmail: jest.fn().mockResolvedValue() }));
jest.mock('../lib/sms', () => ({ sendOrderApprovalSms: jest.fn().mockResolvedValue() }));

const { sendOrderApprovalEmail } = require('../lib/email');
const { sendOrderApprovalSms } = require('../lib/sms');
const adminOrdersRouter = require('../routes/admin.orders.routes');

const app = express();
app.use(express.json());
app.use('/api/admin/orders', adminOrdersRouter);

const SECRET = process.env.JWT_SECRET;
const tokenFor = (role) =>
  'Bearer ' + jwt.sign({ userId: 'u1', email: 'a@b.com', role }, SECRET, { expiresIn: '1h' });

const order = (status, items = []) => ({
  id: 'o1', orderNumber: 'ORD-1', status, total: 100,
  customerEmail: 'c@x.com', customerName: 'C', customerPhone: '+251',
  shippingAddress: 'Addis', items,
});
function setupTransaction(existingOrder, updatedOrder) {
  mockPrisma.order.findUnique
    .mockResolvedValueOnce(existingOrder)   
    .mockResolvedValue(updatedOrder);       
  mockPrisma.order.updateMany.mockResolvedValue({ count: 1 });
  mockPrisma.$transaction.mockImplementation(async (cb) => cb(mockPrisma));
}

beforeEach(() => jest.clearAllMocks());

describe('PATCH /api/admin/orders/:id/status', () => {
  it('requires admin auth', async () => {
    const res = await request(app).patch('/api/admin/orders/o1/status')
      .send({ status: 'CONFIRMED' });
    expect(res.status).toBe(401);
  });

  it('rejects invalid status', async () => {
    const res = await request(app).patch('/api/admin/orders/o1/status')
      .set('Authorization', tokenFor('ADMIN')).send({ status: 'BOGUS' });
    expect(res.status).toBe(400);
  });

  it('confirms a PENDING order and fires approval notifications', async () => {
    setupTransaction(order('PENDING'), order('CONFIRMED'));
    const res = await request(app).patch('/api/admin/orders/o1/status')
      .set('Authorization', tokenFor('ADMIN')).send({ status: 'CONFIRMED' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockPrisma.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'CONFIRMED' } })
    );
    await new Promise((r) => setImmediate(r));
    expect(sendOrderApprovalEmail).toHaveBeenCalled();
    expect(sendOrderApprovalSms).toHaveBeenCalled();
  });

  it('does not send notifications for non-CONFIRMED transitions', async () => {
    setupTransaction(order('CONFIRMED'), order('PROCESSING'));
    const res = await request(app).patch('/api/admin/orders/o1/status')
      .set('Authorization', tokenFor('ADMIN')).send({ status: 'PROCESSING' });
    expect(res.status).toBe(200);
    await new Promise((r) => setImmediate(r));
    expect(sendOrderApprovalEmail).not.toHaveBeenCalled();
    expect(sendOrderApprovalSms).not.toHaveBeenCalled();
  });

  it('rejects illegal transition (DELIVERED -> PENDING-like)', async () => {
    setupTransaction(order('DELIVERED'), order('DELIVERED'));
    const res = await request(app).patch('/api/admin/orders/o1/status')
      .set('Authorization', tokenFor('ADMIN')).send({ status: 'CONFIRMED' });
    expect(res.status).toBe(409);
  });

  it('returns 404 for missing order', async () => {
    mockPrisma.$transaction.mockImplementation(async (cb) => cb(mockPrisma));
    mockPrisma.order.findUnique.mockResolvedValue(null);
    const res = await request(app).patch('/api/admin/orders/nope/status')
      .set('Authorization', tokenFor('ADMIN')).send({ status: 'CONFIRMED' });
    expect(res.status).toBe(404);
  });

  it('restores stock when an order is cancelled', async () => {
    const items = [{ productId: 'p1', quantity: 3 }];
    setupTransaction(order('PENDING', items), order('CANCELLED', items));
    const res = await request(app).patch('/api/admin/orders/o1/status')
      .set('Authorization', tokenFor('ADMIN')).send({ status: 'CANCELLED' });
    expect(res.status).toBe(200);
    expect(mockPrisma.product.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'p1' },
        data: { stock: { increment: 3 } },
      })
    );
  });
});
