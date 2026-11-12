/**
 * Integration tests for the products API (routes/products.routes.js).
 * Prisma is fully mocked — no database needed.
 */

process.env.JWT_SECRET =
  'test-secret-key-that-is-long-enough-32chars!!';

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

const mockPrisma = {
  product: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
  },
};

jest.mock('../lib/prisma', () => mockPrisma);

const productsRouter = require('../routes/products.routes');

const app = express();
app.use(express.json());
app.use('/api/products', productsRouter);

const SECRET = process.env.JWT_SECRET;
const tokenFor = (role) =>
  'Bearer ' +
  jwt.sign({ userId: 'user-1', email: 'u@example.com', role }, SECRET, {
    expiresIn: '1h',
  });

const sampleProduct = {
  id: 'prod-1',
  name: 'Sample Product',
  slug: 'sample-product',
  price: 200,
  discountPrice: 150,
  currency: 'ETB',
  prices: [{ currency: 'ETB', amount: 200 }],
  images: ['https://example.com/p.png'],
  category: { id: 'cat-1', name: 'Plastics', slug: 'plastics' },
  subCategory: null,
  reviews: [],
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('GET /api/products/public', () => {
  it('returns paginated products without authentication', async () => {
    mockPrisma.product.findMany.mockResolvedValue([sampleProduct]);
    mockPrisma.product.count.mockResolvedValue(25);

    const res = await request(app).get('/api/products/public?limit=12');

    expect(res.status).toBe(200);
    expect(res.body.products).toHaveLength(1);
    expect(res.body.total).toBe(25);
    expect(res.body.pages).toBe(3);
    expect(res.body.hasNextPage).toBe(true);
    expect(res.body.hasPrevPage).toBe(false);
  });

  it('serializes discount price as salePrice', async () => {
    mockPrisma.product.findMany.mockResolvedValue([sampleProduct]);
    mockPrisma.product.count.mockResolvedValue(1);

    const res = await request(app).get('/api/products/public');
    expect(res.body.products[0].salePrice).toBe(150);
    expect(res.body.products[0].price).toBe(200);
  });

  it('applies search filter and price sorting', async () => {
    mockPrisma.product.findMany.mockResolvedValue([]);
    mockPrisma.product.count.mockResolvedValue(0);

    await request(app).get(
      '/api/products/public?search=bottle&sort=price_asc'
    );

    expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({ name: expect.anything() }),
          ]),
        }),
        orderBy: [{ price: 'asc' }, { id: 'desc' }],
      })
    );
  });
});

describe('GET /api/products/:id', () => {
  it('returns a single product by id or slug', async () => {
    mockPrisma.product.findFirst.mockResolvedValue(sampleProduct);
    const res = await request(app).get('/api/products/sample-product');
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Sample Product');
    expect(mockPrisma.product.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { OR: [{ id: 'sample-product' }, { slug: 'sample-product' }] },
      })
    );
  });

  it('returns 404 when the product does not exist', async () => {
    mockPrisma.product.findFirst.mockResolvedValue(null);
    const res = await request(app).get('/api/products/missing');
    expect(res.status).toBe(404);
  });
});

describe('GET /api/products/admin/all', () => {
  it('requires authentication', async () => {
    const res = await request(app).get('/api/products/admin/all');
    expect(res.status).toBe(401);
  });

  it('forbids non-admin users', async () => {
    const res = await request(app)
      .get('/api/products/admin/all')
      .set('Authorization', tokenFor('USER'));
    expect(res.status).toBe(403);
  });
});
