/**
 * Tests for the Edit Smarter newsletter system in routes/media.routes.js.
 * Prisma and email fully mocked — no database or network needed.
 */
process.env.JWT_SECRET = 'test-secret-key-that-is-long-enough-32chars!!';

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

const mockPrisma = {
  newsletterSubscriber: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  newsletterIssue: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  newsItem: { findMany: jest.fn() },
  videoRelease: { findMany: jest.fn() },
  popularArticle: { findMany: jest.fn() },
};

jest.mock('../lib/prisma', () => mockPrisma);
jest.mock('../lib/email', () => ({ sendEmail: jest.fn().mockResolvedValue({ ok: true }) }));

const { sendEmail } = require('../lib/email');
const { publicRouter, adminRouter } = require('../routes/media.routes');

const app = express();
app.use(express.json());
app.use('/api/media', publicRouter);
app.use('/api/admin/media', adminRouter);

const SECRET = process.env.JWT_SECRET;
const adminToken =
  'Bearer ' + jwt.sign({ userId: 'admin1', email: 'admin@x.com', role: 'ADMIN' }, SECRET, { expiresIn: '1h' });
const userToken =
  'Bearer ' + jwt.sign({ userId: 'u1', email: 'u@x.com', role: 'USER' }, SECRET, { expiresIn: '1h' });

const validSubscribe = {
  firstName: 'Abebe',
  lastName: 'Kebede',
  email: 'abebe@x.com',
  types: ['edit-smarter', 'news'],
};

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.newsletterSubscriber.create.mockImplementation(async ({ data }) => ({
    id: 's1',
    unsubscribeToken: 'tok1',
    status: 'ACTIVE',
    ...data,
  }));
  mockPrisma.newsletterSubscriber.update.mockImplementation(async ({ data }) => ({
    id: 's1',
    email: 'abebe@x.com',
    firstName: 'Abebe',
    status: 'ACTIVE',
    ...data,
  }));
});

describe('POST /api/media/newsletter/subscribe', () => {
  it('creates a subscriber and sends a confirmation email', async () => {
    mockPrisma.newsletterSubscriber.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/media/newsletter/subscribe')
      .send(validSubscribe);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(mockPrisma.newsletterSubscriber.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        firstName: 'Abebe',
        lastName: 'Kebede',
        email: 'abebe@x.com',
        types: 'edit-smarter,news',
      }),
    });
    // Confirmation email is fire-and-forget — flush microtasks
    await new Promise((r) => setImmediate(r));
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'abebe@x.com' })
    );
  });

  it('rejects missing fields', async () => {
    const res = await request(app)
      .post('/api/media/newsletter/subscribe')
      .send({ firstName: '', lastName: '', email: 'bad', types: [] });
    expect(res.status).toBe(400);
  });

  it('rejects invalid email', async () => {
    const res = await request(app)
      .post('/api/media/newsletter/subscribe')
      .send({ ...validSubscribe, email: 'not-an-email' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/valid email/i);
  });

  it('rejects when no newsletter type selected', async () => {
    const res = await request(app)
      .post('/api/media/newsletter/subscribe')
      .send({ ...validSubscribe, types: [] });
    expect(res.status).toBe(400);
  });

  it('returns 409 for an already-active subscriber', async () => {
    mockPrisma.newsletterSubscriber.findUnique.mockResolvedValue({
      id: 's1',
      email: 'abebe@x.com',
      status: 'ACTIVE',
    });
    const res = await request(app)
      .post('/api/media/newsletter/subscribe')
      .send(validSubscribe);
    expect(res.status).toBe(409);
  });

  it('re-subscribes an unsubscribed address', async () => {
    mockPrisma.newsletterSubscriber.findUnique.mockResolvedValue({
      id: 's1',
      email: 'abebe@x.com',
      status: 'UNSUBSCRIBED',
    });
    const res = await request(app)
      .post('/api/media/newsletter/subscribe')
      .send(validSubscribe);
    expect(res.status).toBe(200);
    expect(mockPrisma.newsletterSubscriber.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'ACTIVE' }),
      })
    );
  });

  it('silently accepts honeypot submissions without creating a record', async () => {
    const res = await request(app)
      .post('/api/media/newsletter/subscribe')
      .send({ ...validSubscribe, website: 'http://spam.example' });
    expect(res.status).toBe(201);
    expect(mockPrisma.newsletterSubscriber.create).not.toHaveBeenCalled();
    expect(mockPrisma.newsletterSubscriber.findUnique).not.toHaveBeenCalled();
  });
});

describe('GET /api/media/newsletter/unsubscribe', () => {
  it('requires a token', async () => {
    const res = await request(app).get('/api/media/newsletter/unsubscribe');
    expect(res.status).toBe(400);
  });

  it('returns 404 for an unknown token', async () => {
    mockPrisma.newsletterSubscriber.findUnique.mockResolvedValue(null);
    const res = await request(app)
      .get('/api/media/newsletter/unsubscribe')
      .query({ token: 'nope' });
    expect(res.status).toBe(404);
  });

  it('marks an active subscriber as UNSUBSCRIBED', async () => {
    mockPrisma.newsletterSubscriber.findUnique.mockResolvedValue({
      id: 's1',
      status: 'ACTIVE',
    });
    mockPrisma.newsletterSubscriber.update.mockResolvedValue({ id: 's1', status: 'UNSUBSCRIBED' });
    const res = await request(app)
      .get('/api/media/newsletter/unsubscribe')
      .query({ token: 'tok1' });
    expect(res.status).toBe(200);
    expect(mockPrisma.newsletterSubscriber.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'UNSUBSCRIBED' } })
    );
  });
});

describe('GET /api/media/newsletter/issues (public archive)', () => {
  it('returns only SENT issues', async () => {
    mockPrisma.newsletterIssue.findMany.mockResolvedValue([
      { id: 'i1', subject: 'Week 1', status: 'SENT' },
    ]);
    const res = await request(app).get('/api/media/newsletter/issues');
    expect(res.status).toBe(200);
    expect(mockPrisma.newsletterIssue.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'SENT' } })
    );
    expect(res.body.items).toHaveLength(1);
  });

  it('404s for a draft issue detail', async () => {
    mockPrisma.newsletterIssue.findFirst.mockResolvedValue(null);
    const res = await request(app).get('/api/media/newsletter/issues/i1');
    expect(res.status).toBe(404);
  });
});

describe('Admin newsletter issues', () => {
  it('requires admin auth', async () => {
    const res = await request(app)
      .post('/api/admin/media/newsletter/issues')
      .set('Authorization', userToken)
      .send({ subject: 'Hi', body: 'Body' });
    expect(res.status).toBe(403);
  });

  it('creates a draft issue', async () => {
    mockPrisma.newsletterIssue.create.mockImplementation(async ({ data }) => ({
      id: 'i1',
      status: 'DRAFT',
      ...data,
    }));
    const res = await request(app)
      .post('/api/admin/media/newsletter/issues')
      .set('Authorization', adminToken)
      .send({ subject: 'Week 1', previewText: 'Teaser', body: 'Hello world', publishedAt: '2026-11-24' });
    expect(res.status).toBe(201);
    expect(mockPrisma.newsletterIssue.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ subject: 'Week 1', body: 'Hello world' }),
    });
  });

  it('rejects an issue without a subject or body', async () => {
    const res = await request(app)
      .post('/api/admin/media/newsletter/issues')
      .set('Authorization', adminToken)
      .send({ subject: '', body: '' });
    expect(res.status).toBe(400);
  });

  it('publish marks SENT and emails matching subscribers', async () => {
    const issue = {
      id: 'i1',
      subject: 'Week 1',
      previewText: null,
      body: 'Hello\n\nWorld',
      status: 'DRAFT',
    };
    mockPrisma.newsletterIssue.findUnique.mockResolvedValue(issue);
    mockPrisma.newsletterIssue.update
      .mockResolvedValueOnce({ ...issue, status: 'SENT' })
      .mockResolvedValueOnce({ ...issue, status: 'SENT', sentCount: 2 });
    const allSubs = [
      { id: 's1', email: 'a@x.com', types: 'edit-smarter', status: 'ACTIVE' },
      { id: 's2', email: 'b@x.com', types: 'news', status: 'ACTIVE' },
      { id: 's3', email: 'c@x.com', types: 'videos', status: 'ACTIVE' }, // no type match
      { id: 's4', email: 'd@x.com', types: 'edit-smarter', status: 'UNSUBSCRIBED' }, // filtered by query
    ];
    mockPrisma.newsletterSubscriber.findMany.mockImplementation(async ({ where } = {}) =>
      allSubs.filter((s) => !where?.status || s.status === where.status)
    );

    const res = await request(app)
      .post('/api/admin/media/newsletter/issues/i1/publish')
      .set('Authorization', adminToken);

    expect(res.status).toBe(200);
    expect(res.body.delivery).toEqual({ sent: 2, failed: 0, total: 2 });
    expect(sendEmail).toHaveBeenCalledTimes(2);
    expect(mockPrisma.newsletterIssue.update).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: { sentCount: 2 } })
    );
  });

  it('publish rejects an already-sent issue', async () => {
    mockPrisma.newsletterIssue.findUnique.mockResolvedValue({
      id: 'i1',
      subject: 'Week 1',
      status: 'SENT',
    });
    const res = await request(app)
      .post('/api/admin/media/newsletter/issues/i1/publish')
      .set('Authorization', adminToken);
    expect(res.status).toBe(400);
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
