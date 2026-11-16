/**
 * Tests for product approval status + stock/arrival countdown dates.
 * Prisma fully mocked — no database needed.
 */
process.env.JWT_SECRET = 'test-secret-key-that-is-long-enough-32chars!!';

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

const mockPrisma = {
  product: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  category: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};

jest.mock('../lib/prisma', () => mockPrisma);

const productsRouter = require('../routes/products.routes');

const app = express();
app.use(express.json());
app.use('/api/products', productsRouter);

const SECRET = process.env.JWT_SECRET;
const tokenFor = (role) =>
  'Bearer ' + jwt.sign({ userId: 'u1', email: 'a@b.com', role }, SECRET, { expiresIn: '1h' });

const baseProduct = {
  id: 'p1', name: 'Widget', slug: 'widget', price: 100, currency: 'ETB',
  images: [], category: { id: 'c1', name: 'Cat', slug: 'cat', image: null },
  subCategory: null, reviews: [], status: 'PENDING', stock: 10,
};

beforeEach(() => jest.clearAllMocks());

describe('POST /api/products — countdown dates', () => {
  const validBody = {
    name: 'Widget', price: 100, stock: 10,
    availableAt: '2026-12-01T10:00:00.000Z',
    restockDate: '2026-12-05T10:00:00.000Z',
    saleEndDate: '2026-11-30T10:00:00.000Z',
  };

  function mockCreateDeps() {
    mockPrisma.category.findFirst.mockResolvedValue(baseProduct.category);
    mockPrisma.product.findUnique.mockResolvedValue(null); // slug free
    mockPrisma.product.create.mockImplementation(({ data }) =>
      Promise.resolve({ ...baseProduct, ...data, category: baseProduct.category })
    );
  }

  it('stores availableAt/restockDate/saleEndDate as Date objects', async () => {
    mockCreateDeps();
    const res = await request(app).post('/api/products')
      .set('Authorization', tokenFor('ADMIN')).send(validBody);
    expect(res.status).toBe(201);
    const data = mockPrisma.product.create.mock.calls[0][0].data;
    expect(data.availableAt).toEqual(new Date(validBody.availableAt));
    expect(data.restockDate).toEqual(new Date(validBody.restockDate));
    expect(data.saleEndDate).toEqual(new Date(validBody.saleEndDate));
    expect(data.status).toBe('PENDING');
  });

  it('serializes the dates back as ISO strings', async () => {
    mockCreateDeps();
    const res = await request(app).post('/api/products')
      .set('Authorization', tokenFor('ADMIN')).send(validBody);
    expect(res.body.product.availableAt).toBe(validBody.availableAt);
    expect(res.body.product.saleEndDate).toBe(validBody.saleEndDate);
  });

  it('sets date fields to null when omitted', async () => {
    mockCreateDeps();
    await request(app).post('/api/products')
      .set('Authorization', tokenFor('ADMIN'))
      .send({ name: 'Widget', price: 100, stock: 10 });
    const data = mockPrisma.product.create.mock.calls[0][0].data;
    expect(data.availableAt).toBeNull();
    expect(data.restockDate).toBeNull();
    expect(data.saleEndDate).toBeNull();
  });

  it('rejects non-admin users', async () => {
    const res = await request(app).post('/api/products')
      .set('Authorization', tokenFor('USER')).send(validBody);
    expect(res.status).toBe(403);
  });
});

describe('PUT /api/products/:id — countdown dates', () => {
  it('updates date fields and clears them with empty string', async () => {
    mockPrisma.product.findUnique.mockResolvedValue(baseProduct);
    mockPrisma.product.update.mockImplementation(({ data }) =>
      Promise.resolve({ ...baseProduct, ...data })
    );

    const res = await request(app).put('/api/products/p1')
      .set('Authorization', tokenFor('ADMIN'))
      .send({ saleEndDate: '2026-12-01T00:00:00.000Z', availableAt: '' });

    expect(res.status).toBe(200);
    const data = mockPrisma.product.update.mock.calls[0][0].data;
    expect(data.saleEndDate).toEqual(new Date('2026-12-01T00:00:00.000Z'));
    expect(data.availableAt).toBeNull();
    expect(data.restockDate).toBeUndefined(); // untouched
  });
});

describe('PATCH /api/products/:id/status — approval', () => {
  it('publishes a pending product', async () => {
    mockPrisma.product.findUnique.mockResolvedValue(baseProduct);
    mockPrisma.product.update.mockResolvedValue({ ...baseProduct, status: 'PUBLISHED' });
    const res = await request(app).patch('/api/products/p1/status')
      .set('Authorization', tokenFor('ADMIN')).send({ status: 'PUBLISHED' });
    expect(res.status).toBe(200);
    expect(mockPrisma.product.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'PUBLISHED' } })
    );
  });

  it('rejects invalid status values', async () => {
    const res = await request(app).patch('/api/products/p1/status')
      .set('Authorization', tokenFor('ADMIN')).send({ status: 'ARCHIVED' });
    expect(res.status).toBe(400);
  });

  it('returns 404 for missing product', async () => {
    mockPrisma.product.findUnique.mockResolvedValue(null);
    const res = await request(app).patch('/api/products/nope/status')
      .set('Authorization', tokenFor('ADMIN')).send({ status: 'PUBLISHED' });
    expect(res.status).toBe(404);
  });

  it('forbids non-admin users', async () => {
    const res = await request(app).patch('/api/products/p1/status')
      .set('Authorization', tokenFor('USER')).send({ status: 'PUBLISHED' });
    expect(res.status).toBe(403);
  });
});

describe('GET /api/products/public — approval filter', () => {
  it('only queries PUBLISHED products', async () => {
    mockPrisma.product.findMany.mockResolvedValue([]);
    mockPrisma.product.count.mockResolvedValue(0);
    await request(app).get('/api/products/public');
    expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: 'PUBLISHED' }) })
    );
  });
});
