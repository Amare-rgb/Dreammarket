// routes/products.routes.js
const express = require('express');
const router = express.Router();
const slugify = require('slugify');
const fs = require('fs');
const path = require('path');
const prisma = require('../lib/prisma');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const UPLOAD_ROOT = path.resolve(__dirname, '..', 'uploads');

// ═══════════════════════════════════════════════════════════
// Dream More Affiliate Market — Products API
//  • Storage: local disk (/uploads)
//  • Database: Neon (PostgreSQL) via Prisma
// ═══════════════════════════════════════════════════════════

// ── Multi-currency helpers ──────────────────────────────────
function normalizePrices(rawPrices, fallbackPrice, fallbackCurrency = 'ETB') {
  const list = [];
  if (Array.isArray(rawPrices)) {
    for (const p of rawPrices) {
      const currency = typeof p?.currency === 'string' ? p.currency.toUpperCase() : null;
      const amount = Number(p?.amount);
      if (currency && Number.isFinite(amount) && amount > 0) {
        list.push({ currency, amount });
      }
    }
  }
  
  // Deduplicate by currency
  const seen = new Set();
  const deduped = list.filter((p) => {
    if (seen.has(p.currency)) return false;
    seen.add(p.currency);
    return true;
  });

  // If empty, fallback to the single price
  if (deduped.length === 0) {
    const amount = Number(fallbackPrice);
    const currency = String(fallbackCurrency || 'ETB').toUpperCase();
    if (Number.isFinite(amount) && amount > 0) {
      deduped.push({ currency, amount });
    }
  }
  return deduped;
}

function serializeProduct(product) {
  if (!product) return product;
  const price = Number(product.price) || 0;
  const dbPrices = Array.isArray(product.prices) ? product.prices : [];
  
  // If DB has prices, use them. Otherwise, build one from the base price.
  const prices = dbPrices.length > 0 ? dbPrices : [{ currency: product.currency || 'ETB', amount: price }];

  return {
    ...product,
    price: Number(product.price),
    currency: product.currency || 'ETB',
    prices: prices,
    discountPrice: product.discountPrice ? Number(product.discountPrice) : null,
    pricePerUnit: product.pricePerUnit ? Number(product.pricePerUnit) : null,
    salePrice: product.discountPrice ? Number(product.discountPrice) : null,
  };
}

// ── Local upload cleanup ────────────────────────────────────
function getLocalUploadPath(url) {
  if (typeof url !== 'string' || !url.trim()) return null;
  try {
    const pathname = new URL(url, 'http://localhost').pathname;
    if (!pathname.startsWith('/uploads/')) return null;
    const relativePath = pathname
      .slice('/uploads/'.length)
      .split('/')
      .map((segment) => decodeURIComponent(segment));
    if (
      relativePath.some(
        (segment) => !segment || segment === '.' || segment === '..'
      )
    ) {
      return null;
    }
    const filePath = path.resolve(UPLOAD_ROOT, ...relativePath);
    const relativeToRoot = path.relative(UPLOAD_ROOT, filePath);
    if (
      relativeToRoot.startsWith('..') ||
      path.isAbsolute(relativeToRoot)
    ) {
      return null;
    }
    return filePath;
  } catch {
    return null;
  }
}

async function deleteLocalImages(urls) {
  if (!Array.isArray(urls) || urls.length === 0) return;
  const filePaths = urls.map(getLocalUploadPath).filter(Boolean);
  const results = await Promise.allSettled(
    filePaths.map((filePath) => fs.promises.unlink(filePath))
  );
  for (const result of results) {
    if (result.status === 'rejected' && result.reason.code !== 'ENOENT') {
      console.warn('Local product image cleanup failed:', result.reason.message);
    }
  }
}

// ============================================================
// GET /api/products/admin/all — Admin view (all products)
// ============================================================
router.get('/admin/all', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 12, search, categoryId, subCategoryId } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 12);
    const skip = (pageNum - 1) * limitNum;
    const take = limitNum;

    const where = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (categoryId) where.categoryId = categoryId;
    if (subCategoryId) where.subCategoryId = subCategoryId;

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: {
          category: { select: { id: true, name: true, slug: true } },
          subCategory: { select: { id: true, name: true, slug: true } },
        },
      }),
      prisma.product.count({ where }),
    ]);

    const productsWithNumbers = products.map((p) => serializeProduct(p));

    res.json({
      products: productsWithNumbers,
      total,
      pages: Math.max(1, Math.ceil(total / limitNum)),
      page: pageNum,
      limit: limitNum,
      hasNextPage: pageNum * limitNum < total,
      hasPrevPage: pageNum > 1,
    });
  } catch (error) {
    console.error('Error fetching admin products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// ============================================================
// GET /api/products/public — Public product list
// ============================================================
router.get('/public', async (req, res) => {
  try {
    const { page = 1, limit = 12, search, categoryId, subCategoryId, sort } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 12);
    const skip = (pageNum - 1) * limitNum;
    const take = limitNum;

    const where = {};

    if (categoryId) where.categoryId = categoryId;
    if (subCategoryId) where.subCategoryId = subCategoryId;

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    let orderBy;
    if (sort === 'price_asc') orderBy = [{ price: 'asc' }, { id: 'desc' }];
    else if (sort === 'price_desc') orderBy = [{ price: 'desc' }, { id: 'desc' }];
    else if (sort === 'name_asc') orderBy = [{ name: 'asc' }, { id: 'desc' }];
    else if (sort === 'name_desc') orderBy = [{ name: 'desc' }, { id: 'desc' }];
    else orderBy = [{ createdAt: 'desc' }, { id: 'desc' }];

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take,
        orderBy,
        include: {
          category: { select: { id: true, name: true, slug: true } },
          subCategory: { select: { id: true, name: true, slug: true } },
        },
      }),
      prisma.product.count({ where }),
    ]);

    const productsWithNumbers = products.map((p) => serializeProduct(p));

    res.json({
      products: productsWithNumbers,
      total,
      pages: Math.max(1, Math.ceil(total / limitNum)),
      page: pageNum,
      limit: limitNum,
      hasNextPage: pageNum * limitNum < total,
      hasPrevPage: pageNum > 1,
    });
  } catch (error) {
    console.error('Error fetching public products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// ============================================================
// GET /api/products — Backward-compatible product list
// ============================================================
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 12,
      category,
      search,
      sort = 'newest',
      minPrice,
      maxPrice,
      brand,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 12);
    const skip = (pageNum - 1) * limitNum;
    const take = limitNum;

    const where = {};

    if (category) where.category = { slug: category };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { tags: { hasSome: [search] } },
      ];
    }

    if (minPrice || maxPrice) {
      where.price = {};
      if (minPrice) where.price.gte = parseFloat(minPrice);
      if (maxPrice) where.price.lte = parseFloat(maxPrice);
    }

    if (brand) where.brand = brand;

    let orderBy;
    if (sort === 'price_asc') orderBy = [{ price: 'asc' }, { id: 'desc' }];
    else if (sort === 'price_desc') orderBy = [{ price: 'desc' }, { id: 'desc' }];
    else orderBy = [{ createdAt: 'desc' }, { id: 'desc' }];

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy,
        skip,
        take,
        include: {
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
              description: true,
              image: true,
              parentId: true,
            },
          },
          subCategory: { select: { id: true, name: true, slug: true } },
        },
      }),
      prisma.product.count({ where }),
    ]);

    const productsWithDetails = products.map((product) => serializeProduct(product));

    res.json({
      products: productsWithDetails,
      total,
      pages: Math.max(1, Math.ceil(total / limitNum)),
      page: pageNum,
      limit: limitNum,
      hasNextPage: pageNum * limitNum < total,
      hasPrevPage: pageNum > 1,
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// ============================================================
// GET /api/products/:id — Single product
// ============================================================
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const product = await prisma.product.findFirst({
      where: { OR: [{ id }, { slug: id }] },
      include: {
        category: true,
        subCategory: true,
        reviews: {
          include: { user: { select: { name: true, avatar: true } } },
        },
      },
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json(serializeProduct(product));
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

// ============================================================
// POST /api/products — Create product (ADMIN ONLY)
// ============================================================
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const body = req.body;
    const userId = req.user?.id || req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // ── Normalise images ────────────────────────────────────
    const incomingImages = Array.isArray(body.images) ? body.images : [];
    const cleanImages = incomingImages.filter(
      (u) => typeof u === 'string' && u.trim().length > 0
    );

    // ── Discount price ──────────────────────────────────────
    let discountPriceValue = body.discountPrice;
    if (
      body.salePrice !== undefined &&
      body.salePrice !== null &&
      body.salePrice !== ''
    ) {
      discountPriceValue = parseFloat(body.salePrice);
    }
    if (
      discountPriceValue === '' ||
      discountPriceValue === null ||
      discountPriceValue === undefined
    ) {
      discountPriceValue = null;
    }

    // ── Stock ───────────────────────────────────────────────
    let stockValue = 0;
    if (body.stock !== undefined && body.stock !== null && body.stock !== '') {
      stockValue =
        typeof body.stock === 'string' ? parseInt(body.stock, 10) : body.stock;
    }

    // ── Normalize Prices ────────────────────────────────────
    const normalizedPrices = normalizePrices(body.prices, body.price, body.currency);
    const primaryPrice = normalizedPrices[0];

    const productData = {
      name: body.name,
      description: body.description,
      price: primaryPrice ? primaryPrice.amount : (parseFloat(body.price) || 0),
      currency: primaryPrice ? primaryPrice.currency : 'ETB',
      prices: normalizedPrices, // Save JSON array
      discountPrice: discountPriceValue,
      stock: stockValue,
      sku: body.sku || `SKU-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      images: cleanImages,
      tags: Array.isArray(body.tags) ? body.tags : [],
      warranty: body.warranty || null,
      videoUrl: body.videoUrl || null,
      sizes: body.sizes || null,
      colors: body.colors || null,
      brand: body.brand || null,
      weight: body.weight
        ? typeof body.weight === 'string'
          ? parseFloat(body.weight)
          : body.weight
        : null,
      estimatedDelivery: body.estimatedDelivery || null,
      unitOfMeasurement: body.unitOfMeasurement || 'pcs',
      durationTime: body.durationTime || '1h',
      pricePerUnit: body.pricePerUnit
        ? typeof body.pricePerUnit === 'string'
          ? parseFloat(body.pricePerUnit)
          : body.pricePerUnit
        : null,
    };

    // ── Resolve category ────────────────────────────────────
    let resolvedCategory = await prisma.category.findFirst({
      where: { OR: [{ id: body.categoryId }, { slug: body.categoryId }] },
    });

    if (!resolvedCategory) {
      resolvedCategory = await prisma.category.findFirst();
      if (!resolvedCategory) {
        resolvedCategory = await prisma.category.create({
          data: {
            name: 'General Plastic Products',
            slug: 'general-plastic-products',
            description: 'General plastic product category',
          },
        });
      }
    }

    // ── Resolve subcategory ─────────────────────────────────
    let resolvedSubCategoryId = null;
    if (body.subCategoryId) {
      const foundSub = await prisma.category.findFirst({
        where: {
          OR: [{ id: body.subCategoryId }, { slug: body.subCategoryId }],
        },
      });
      if (foundSub) resolvedSubCategoryId = foundSub.id;
    }

    // ── Unique slug ─────────────────────────────────────────
    const baseSlug =
      slugify(productData.name, { lower: true, strict: true, trim: true }) ||
      `product-${Date.now()}`;
    let slug = baseSlug;
    let counter = 1;
    while (await prisma.product.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    // ── Save to Neon ────────────────────────────────────────
    const product = await prisma.product.create({
      data: {
        ...productData,
        slug,
        categoryId: resolvedCategory.id,
        subCategoryId: resolvedSubCategoryId,
      },
      include: { category: true, subCategory: true },
    });

    // ── Optionally set category image from first product image ──
    try {
      const firstImage = cleanImages[0];
      if (resolvedCategory && !resolvedCategory.image && firstImage) {
        await prisma.category.update({
          where: { id: resolvedCategory.id },
          data: { image: firstImage },
        });
        console.log(
          `🖼️ Category "${resolvedCategory.name}" image auto-set from product: ${firstImage}`
        );
      }
    } catch (categoryImgErr) {
      console.warn('⚠️ Could not auto-assign category image:', categoryImgErr);
    }

    res.status(201).json({
      success: true,
      product: serializeProduct(product),
      message: 'Product created successfully!',
    });
  } catch (error) {
    console.error('Product creation error:', error);
    res.status(500).json({
      error: 'Failed to create product',
      details: error.message,
    });
  }
});

// ============================================================
// PUT /api/products/:id — Update product (ADMIN ONLY)
// ============================================================
router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body;
    const userId = req.user?.id || req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const existingProduct = await prisma.product.findUnique({
      where: { id },
    });

    if (!existingProduct) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const updateData = {};

    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    
    // ── Update Prices ───────────────────────────────────────
    if (body.prices !== undefined) {
      const normalizedPrices = normalizePrices(
        body.prices, 
        body.price || existingProduct.price, 
        body.currency || existingProduct.currency
      );
      updateData.prices = normalizedPrices;
      if (normalizedPrices[0]) {
        updateData.price = normalizedPrices[0].amount;
        updateData.currency = normalizedPrices[0].currency;
      }
    } else if (body.price !== undefined) {
      updateData.price = parseFloat(body.price);
    }

    if (body.discountPrice !== undefined) {
      updateData.discountPrice = body.discountPrice
        ? parseFloat(body.discountPrice)
        : null;
    }
    if (body.pricePerUnit !== undefined) {
      updateData.pricePerUnit = body.pricePerUnit
        ? parseFloat(body.pricePerUnit)
        : null;
    }
    if (body.stock !== undefined) {
      updateData.stock =
        typeof body.stock === 'string'
          ? parseInt(body.stock, 10)
          : body.stock;
    }
    if (body.images !== undefined) {
      const incoming = Array.isArray(body.images) ? body.images : [];
      updateData.images = incoming.filter(
        (u) => typeof u === 'string' && u.trim().length > 0
      );
    }
    if (body.tags !== undefined)
      updateData.tags = Array.isArray(body.tags) ? body.tags : [];
    if (body.brand !== undefined) updateData.brand = body.brand || null;
    if (body.warranty !== undefined) updateData.warranty = body.warranty || null;
    if (body.videoUrl !== undefined) updateData.videoUrl = body.videoUrl || null;
    if (body.unitOfMeasurement !== undefined)
      updateData.unitOfMeasurement = body.unitOfMeasurement;
    if (body.durationTime !== undefined)
      updateData.durationTime = body.durationTime || '1h';
    if (body.weight !== undefined) {
      updateData.weight = body.weight
        ? typeof body.weight === 'string'
          ? parseFloat(body.weight)
          : body.weight
        : null;
    }

    if (body.categoryId) {
      const cat = await prisma.category.findFirst({
        where: { OR: [{ id: body.categoryId }, { slug: body.categoryId }] },
      });
      if (cat) updateData.categoryId = cat.id;
    }

    if (body.subCategoryId) {
      const subCat = await prisma.category.findFirst({
        where: {
          OR: [{ id: body.subCategoryId }, { slug: body.subCategoryId }],
        },
      });
      if (subCat) updateData.subCategoryId = subCat.id;
    }

    const updated = await prisma.product.update({
      where: { id },
      data: updateData,
      include: { category: true, subCategory: true },
    });

    // ── Delete orphaned local images ─────────────────────────
    if (updateData.images !== undefined) {
      const oldImages = Array.isArray(existingProduct.images)
        ? existingProduct.images
        : [];
      const newImages = updateData.images;
      const removed = oldImages.filter((u) => !newImages.includes(u));
      if (removed.length > 0) {
        deleteLocalImages(removed).catch((err) =>
          console.warn('Local product image cleanup failed:', err.message)
        );
      }
    }

    // ── Optionally set category image if it was empty ───────
    try {
      const firstImage = Array.isArray(updated.images) ? updated.images[0] : null;
      if (updated.category && !updated.category.image && firstImage) {
        await prisma.category.update({
          where: { id: updated.category.id },
          data: { image: firstImage },
        });
      }
    } catch (categoryImgErr) {
      console.warn(
        '⚠️ Could not auto-assign category image on update:',
        categoryImgErr
      );
    }

    res.json({
      success: true,
      product: serializeProduct(updated),
      message: 'Product updated successfully',
    });
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// ============================================================
// DELETE /api/products/:id — Delete product (ADMIN ONLY)
// ============================================================
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const existingProduct = await prisma.product.findUnique({
      where: { id },
    });

    if (!existingProduct) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // ── 1. Delete from Neon (reviews + product) ─────────────
    await prisma.$transaction([
      prisma.review.deleteMany({ where: { productId: id } }),
      prisma.product.delete({ where: { id } }),
    ]);

    // ── 2. Delete local images (fire-and-forget) ────────────
    if (Array.isArray(existingProduct.images) && existingProduct.images.length) {
      deleteLocalImages(existingProduct.images).catch((err) =>
        console.warn('Local product image cleanup failed on delete:', err.message)
      );
    }

    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

module.exports = router;