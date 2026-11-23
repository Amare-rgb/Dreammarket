/**
 * Tests for POST /api/admin/rewards/dispatch (routes/admin.routes.js).
 * Prisma, SMS and email fully mocked — no database or network needed.
 */
process.env.JWT_SECRET = 'test-secret-key-that-is-long-enough-32chars!!';
delete process.env.AT_API_KEY;
delete process.env.AT_USERNAME;

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

const mockPrisma = {
  rewardRule: { findUnique: jest.fn() },
  user: { findUnique: jest.fn() },
  order: { findUnique: jest.fn() },
  airtimeVoucher: { findFirst: jest.fn(), update: jest.fn() },
  rewardDispatch: { create: jest.fn() },
};

jest.mock('../lib/prisma', () => mockPrisma);
jest.mock('../lib/sms', () => ({ sendSms: jest.fn().mockResolvedValue({ ok: true }) }));
jest.mock('../lib/email', () => ({ sendEmail: jest.fn().mockResolvedValue({ ok: true }) }));

const { sendSms } = require('../lib/sms');
const { sendEmail } = require('../lib/email');
const adminRouter = require('../routes/admin.routes');

const app = express();
app.use(express.json());
app.use('/api/admin', adminRouter);

const SECRET = process.env.JWT_SECRET;
const adminToken =
  'Bearer ' + jwt.sign({ userId: 'admin1', email: 'admin@x.com', role: 'ADMIN' }, SECRET, { expiresIn: '1h' });
const userToken =
  'Bearer ' + jwt.sign({ userId: 'u1', email: 'u@x.com', role: 'USER' }, SECRET, { expiresIn: '1h' });

const cashbackRule = {
  id: 'rule1',
  name: 'Buy 2 get reward',
  rewardType: 'FIXED_CASHBACK',
  rewardValue: '300',
  active: true,
};

const airtimeRule = {
  id: 'rule2',
  name: 'Airtime reward',
  rewardType: 'MOBILE_AIRTIME',
  rewardValue: '50',
  active: true,
};

const order = {
  id: 'o1',
  customerName: 'Abebe',
  customerEmail: 'abebe@x.com',
  customerPhone: '0911234567',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.rewardDispatch.create.mockImplementation(async ({ data }) => ({ id: 'd1', ...data }));
});

describe('POST /api/admin/rewards/dispatch', () => {
  it('requires admin auth', async () => {
    const res = await request(app)
      .post('/api/admin/rewards/dispatch')
      .set('Authorization', userToken)
      .send({ channel: 'SMS' });
    expect(res.status).toBe(403);
  });

  it('rejects invalid channel', async () => {
    const res = await request(app)
      .post('/api/admin/rewards/dispatch')
      .set('Authorization', adminToken)
      .send({ channel: 'PIGEON' });
    expect(res.status).toBe(400);
  });

  it('returns 404 for unknown reward rule', async () => {
    mockPrisma.rewardRule.findUnique.mockResolvedValue(null);
    const res = await request(app)
      .post('/api/admin/rewards/dispatch')
      .set('Authorization', adminToken)
      .send({ rewardRuleId: 'nope', channel: 'SMS' });
    expect(res.status).toBe(404);
  });

  it('resolves recipient from the order and dispatches SMS + email', async () => {
    mockPrisma.rewardRule.findUnique.mockResolvedValue(cashbackRule);
    mockPrisma.order.findUnique.mockResolvedValue(order);

    const res = await request(app)
      .post('/api/admin/rewards/dispatch')
      .set('Authorization', adminToken)
      .send({ rewardRuleId: 'rule1', orderId: 'o1', channel: 'BOTH' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(sendSms).toHaveBeenCalledWith(
      expect.objectContaining({
        to: '0911234567',
        message: expect.stringContaining('Buy 2 get reward'),
      })
    );
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'abebe@x.com',
        subject: expect.any(String),
        text: expect.any(String),
      })
    );
    expect(mockPrisma.rewardDispatch.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          orderId: 'o1',
          recipientPhone: '0911234567',
          recipientEmail: 'abebe@x.com',
          status: 'SENT',
        }),
      })
    );
  });

  it('prefers explicit recipient over order lookup', async () => {
    mockPrisma.rewardRule.findUnique.mockResolvedValue(cashbackRule);
    mockPrisma.order.findUnique.mockResolvedValue(order);

    await request(app)
      .post('/api/admin/rewards/dispatch')
      .set('Authorization', adminToken)
      .send({
        rewardRuleId: 'rule1',
        orderId: 'o1',
        recipientPhone: '0919999999',
        recipientEmail: 'direct@x.com',
        channel: 'SMS',
      });

    expect(sendSms).toHaveBeenCalledWith(
      expect.objectContaining({ to: '0919999999', message: expect.any(String) })
    );
    // Order is still loaded to link the dispatch record, but its contact
    // details must not override the explicit recipient.
    expect(mockPrisma.order.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'o1' } })
    );
  });

  it('MOBILE_AIRTIME consumes an available voucher and texts the PIN', async () => {
    mockPrisma.rewardRule.findUnique.mockResolvedValue(airtimeRule);
    mockPrisma.order.findUnique.mockResolvedValue(order);
    mockPrisma.airtimeVoucher.findFirst
      .mockResolvedValueOnce({ id: 'v1', amount: 50, pinCode: 'PIN123', network: 'Ethio Telecom', status: 'AVAILABLE' })
      .mockResolvedValue(null);
    mockPrisma.airtimeVoucher.update.mockResolvedValue({
      id: 'v1', amount: 50, pinCode: 'PIN123', network: 'Ethio Telecom', status: 'USED',
    });

    const res = await request(app)
      .post('/api/admin/rewards/dispatch')
      .set('Authorization', adminToken)
      .send({ rewardRuleId: 'rule2', orderId: 'o1', channel: 'SMS' });

    expect(res.status).toBe(200);
    expect(mockPrisma.airtimeVoucher.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'v1' },
        data: expect.objectContaining({ status: 'USED', assignedOrderId: 'o1' }),
      })
    );
    expect(sendSms).toHaveBeenCalledWith(
      expect.objectContaining({
        to: '0911234567',
        message: expect.stringContaining('PIN123'),
      })
    );
  });

  it('MOBILE_AIRTIME fails cleanly when no voucher and no API keys', async () => {
    mockPrisma.rewardRule.findUnique.mockResolvedValue(airtimeRule);
    mockPrisma.order.findUnique.mockResolvedValue(order);
    mockPrisma.airtimeVoucher.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/admin/rewards/dispatch')
      .set('Authorization', adminToken)
      .send({ rewardRuleId: 'rule2', orderId: 'o1', channel: 'SMS' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(sendSms).not.toHaveBeenCalled();
  });

  it('records FAILED dispatch when delivery fails', async () => {
    mockPrisma.rewardRule.findUnique.mockResolvedValue(cashbackRule);
    mockPrisma.order.findUnique.mockResolvedValue(order);
    sendSms.mockRejectedValueOnce(new Error('SMS gateway down'));
    sendEmail.mockRejectedValueOnce(new Error('SMTP down'));

    const res = await request(app)
      .post('/api/admin/rewards/dispatch')
      .set('Authorization', adminToken)
      .send({ rewardRuleId: 'rule1', orderId: 'o1', channel: 'BOTH' });

    expect(res.status).toBe(502);
    expect(mockPrisma.rewardDispatch.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'FAILED' }),
      })
    );
  });
});
