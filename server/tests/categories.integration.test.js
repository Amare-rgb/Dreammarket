/**
 * Integration tests for the categories API (routes/categories.routes.js).
 * Prisma is fully mocked — no database needed.
 */

process.env.JWT_SECRET =
  'test-secret-key-that-is-long-enough-32chars!!';

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

const mockPrisma = {
  user: { findUnique: jest.fn() },
  category: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

jest.mock('../lib/prisma', () => mockPrisma);

const categoriesRouter = require('../routes/categories.routes');

const app = express();
app.use(express.json());
app.use('/api/categories', categoriesRouter);

const SECRET = process.env.JWT_SECRET;
const tokenFor = (role) =>
  'Bearer ' +
  jwt.sign({ userId: 'admin-1', email: 'admin@example.com', role }, SECRET, {
    expiresIn: '1h',
  });

const sampleCategory = {
  id: 'cat-1',
  name: 'Plastics',
  slug: 'plastics',
  parentId: null,
  image: 'https://example.com/cat.png',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.user.findUnique.mockResolvedValue({ id: 'admin-1' });
});

describe('GET /api/categories', () => {
  it('returns subcategories when parentId is given', async () => {
    mockPrisma.category.findMany.mockResolvedValue([sampleCategory]);
    const res = await request(app).get('/api/categories?parentId=cat-1');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(mockPrisma.category.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { parentId: 'cat-1' } })
    );
  });

  it('returns a flat list by default', async () => {
    mockPrisma.category.findMany.mockResolvedValue([sampleCategory]);
    const res = await request(app).get('/api/categories');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('GET /api/categories/:id', () => {
  it('returns a category by id or slug', async () => {
    mockPrisma.category.findFirst.mockResolvedValue(sampleCategory);
    const res = await request(app).get('/api/categories/plastics');
    expect(res.status).toBe(200);
    expect(res.body.slug).toBe('plastics');
    expect(mockPrisma.category.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { OR: [{ id: 'plastics' }, { slug: 'plastics' }] },
      })
    );
  });

  it('returns 404 for an unknown category', async () => {
    mockPrisma.category.findFirst.mockResolvedValue(null);
    const res = await request(app).get('/api/categories/nope');
    expect(res.status).toBe(404);
  });
});

describe('GET /api/categories/admin/all', () => {
  it('requires authentication', async () => {
    const res = await request(app).get('/api/categories/admin/all');
    expect(res.status).toBe(401);
  });

  it('forbids non-admin users', async () => {
    const res = await request(app)
      .get('/api/categories/admin/all')
      .set('Authorization', tokenFor('USER'));
    expect(res.status).toBe(403);
  });

  it('returns all categories for admins', async () => {
    mockPrisma.category.findMany.mockResolvedValue([sampleCategory]);
    const res = await request(app)
      .get('/api/categories/admin/all')
      .set('Authorization', tokenFor('ADMIN'));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });
});

describe('POST /api/categories', () => {
  it('requires name and slug', async () => {
    const res = await request(app)
      .post('/api/categories')
      .set('Authorization', tokenFor('ADMIN'))
      .send({ slug: 'x' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/name/i);
  });

  it('creates a category and stores a valid image URL', async () => {
    mockPrisma.category.create.mockImplementation(async ({ data }) => ({
      id: 'cat-new',
      ...data,
    }));

    const res = await request(app)
      .post('/api/categories')
      .set('Authorization', tokenFor('ADMIN'))
      .send({
        name: 'New Category',
        slug: 'new-category',
        image: 'https://example.com/img.png',
      });

    expect(res.status).toBe(201);
    expect(res.body.createdBy).toBe('admin-1');
    expect(res.body.image).toBe('https://example.com/img.png');
  });

  it('rejects non-URL image values', async () => {
    mockPrisma.category.create.mockImplementation(async ({ data }) => ({
      id: 'cat-new',
      ...data,
    }));

    const res = await request(app)
      .post('/api/categories')
      .set('Authorization', tokenFor('ADMIN'))
      .send({
        name: 'New Category',
        slug: 'new-category',
        image: 'javascript:alert(1)',
      });

    expect(res.status).toBe(201);
    expect(res.body.image).toBeNull();
  });
});

describe('DELETE /api/categories/:id', () => {
  it('blocks deletion when the category has products', async () => {
    mockPrisma.category.findUnique.mockResolvedValue({
      id: 'cat-1',
      _count: { products: 3, children: 0 },
    });
    const res = await request(app)
      .delete('/api/categories/cat-1')
      .set('Authorization', tokenFor('ADMIN'));
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/products/i);
  });

  it('deletes an empty category', async () => {
    mockPrisma.category.findUnique.mockResolvedValue({
      id: 'cat-1',
      _count: { products: 0, children: 0 },
    });
    mockPrisma.category.delete.mockResolvedValue({ id: 'cat-1' });
    const res = await request(app)
      .delete('/api/categories/cat-1')
      .set('Authorization', tokenFor('ADMIN'));
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
