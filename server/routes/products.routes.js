const express = require('express');
const router = express.Router();
const slugify = require('slugify');
const fs = require('fs');
const path = require('path');
const prisma = require('../lib/prisma');
const { requireAuth, requireAdmin, optionalAuth } = require('../middleware/auth');
const UPLOAD_ROOT = path.resolve(__dirname, '..', 'uploads');
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
  
  const seen = new Set();
  const deduped = list.filter((p) => {
    if (seen.has(p.currency)) return false;
    seen.add(p.currency);
    return true;
  });

  if (deduped.length === 0) {
    const amount = Number(fallbackPrice);
    const currency = String(fallbackCurrency || 'ETB').toUpperCase();
    if (Number.isFinite(amount) && amount > 0) {
      deduped.push({ currency, amount });
    }
  }
  return deduped;
}
function normalizeDiscountPrices(rawDiscounts, prices) {
  if (!Array.isArray(rawDiscounts) || rawDiscounts.length === 0) return [];
  const priceMap = new Map((prices || []).map((p) => [p.currency, p.amount]));
  const seen = new Set();
  const result = [];
  for (const d of rawDiscounts) {
    const currency = typeof d?.currency === 'string' ? d.currency.toUpperCase() : null;
    const amount = Number(d?.amount);
    const original = priceMap.get(currency);
    if (
      currency &&
      !seen.has(currency) &&
      Number.isFinite(amount) &&
      amount > 0 &&
      original !== undefined &&
      amount < original
    ) {
      seen.add(currency);
      result.push({ currency, amount });
    }
  }
  return result;
}

function serializeProduct(product) {
  if (!product) return product;
  const price = Number(product.price) || 0;
  const dbPrices = Array.isArray(product.prices) ? product.prices : [];
  
  const prices = dbPrices.length > 0 ? dbPrices : [{ currency: product.currency || 'ETB', amount: price }];

  return {
    ...product,
    price: Number(product.price),
    currency: product.currency || 'ETB',
    prices: prices,
    discountPrice: product.discountPrice ? Number(product.discountPrice) : null,
    discountPrices: Array.isArray(product.discountPrices) ? product.discountPrices : [],
    pricePerUnit: product.pricePerUnit ? Number(product.pricePerUnit) : null,
    salePrice: product.discountPrice ? Number(product.discountPrice) : null,
  };
}
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
router.get('/admin/all', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 12, search, categoryId, subCategoryId, status } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 12);
    const skip = (pageNum - 1) * limitNum;
    const take = limitNum;

    const where = {};
    if (status === 'PENDING' || status === 'PUBLISHED') {
      where.status = status;
    }

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

router.get('/public', async (req, res) => {
  try {
    const { page = 1, limit = 12, search, categoryId, subCategoryId, sort } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 12);
    const skip = (pageNum - 1) * limitNum;
    const take = limitNum;

    const where = { status: 'PUBLISHED' };

    if (categoryId) where.categoryId = categoryId;
    if (subCategoryId) where.subCategoryId = subCategoryId;

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { sizesList: { some: { size: { contains: search, mode: 'insensitive' } } } },
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
          sizesList: { orderBy: { size: 'asc' } },
          rewardRules: {
            where: { active: true },
            select: {
              id: true, name: true, scope: true, triggerType: true,
              threshold: true, rewardType: true, rewardValue: true,
              promoCode: true, expiresAt: true,
            },
          },
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
    const where = { status: 'PUBLISHED' };

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

router.get('/:id', optionalAuth, async (req, res) => {
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
        sideProductLinks: {
          orderBy: { sortOrder: 'asc' },
          include: {
            sideProduct: {
              select: {
                id: true, name: true, slug: true, price: true, currency: true,
                prices: true, discountPrice: true, discountPrices: true,
                stock: true, images: true, availabilityStatus: true,
              },
            },
          },
        },
        sizesList: { orderBy: { size: 'asc' } },
        rewardRules: {
          where: { active: true },
          select: {
            id: true, name: true, scope: true, triggerType: true,
            threshold: true, rewardType: true, rewardValue: true,
            promoCode: true, expiresAt: true,
          },
        },
      },
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    const isAdmin = req.user?.role?.toUpperCase() === 'ADMIN';
    if (product.status !== 'PUBLISHED' && !isAdmin) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json(serializeProduct(product));
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const body = req.body;
    const userId = req.user?.id || req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    const incomingImages = Array.isArray(body.images) ? body.images : [];
    const cleanImages = incomingImages.filter(
      (u) => typeof u === 'string' && u.trim().length > 0
    );
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
    let stockValue = 0;
    if (body.stock !== undefined && body.stock !== null && body.stock !== '') {
      stockValue =
        typeof body.stock === 'string' ? parseInt(body.stock, 10) : body.stock;
    }
    const VALID_STATUSES = ['AVAILABLE', 'OUT_OF_STOCK_TEMPORARY'];
    let availabilityStatus =
      typeof body.availabilityStatus === 'string' &&
      VALID_STATUSES.includes(body.availabilityStatus.toUpperCase())
        ? body.availabilityStatus.toUpperCase()
        : stockValue > 0
          ? 'AVAILABLE'
          : 'OUT_OF_STOCK_TEMPORARY';
    if (availabilityStatus === 'OUT_OF_STOCK_TEMPORARY' && stockValue > 0) {
    }

    const outOfStockAt =
      availabilityStatus === 'OUT_OF_STOCK_TEMPORARY'
        ? new Date()
        : null;

    const autoRestock =
      body.autoRestock !== undefined ? Boolean(body.autoRestock) : true;

    const restockAfterDays =
      body.restockAfterDays !== undefined && body.restockAfterDays !== null && body.restockAfterDays !== ''
        ? Math.max(1, parseInt(body.restockAfterDays, 10) || 2)
        : 2;

    const restockQuantity =
      body.restockQuantity !== undefined && body.restockQuantity !== null && body.restockQuantity !== ''
        ? Math.max(1, parseInt(body.restockQuantity, 10) || 10)
        : 10;
    const normalizedPrices = normalizePrices(body.prices, body.price, body.currency);
    const primaryPrice = normalizedPrices[0];
    const normalizedDiscountPrices = normalizeDiscountPrices(body.discountPrices, normalizedPrices);
    const primaryDiscount = normalizedDiscountPrices.find(
      (d) => d.currency === (primaryPrice?.currency || 'ETB')
    );
    const effectiveDiscountPrice = primaryDiscount ? primaryDiscount.amount : null;

    const productData = {
      name: body.name,
      description: body.description,
      price: primaryPrice ? primaryPrice.amount : (parseFloat(body.price) || 0),
      currency: primaryPrice ? primaryPrice.currency : 'ETB',
      prices: normalizedPrices, 
      discountPrice: effectiveDiscountPrice,
      discountPrices: normalizedDiscountPrices.length > 0 ? normalizedDiscountPrices : null,
      stock: stockValue,
      availabilityStatus,
      outOfStockAt,
      autoRestock,
      restockAfterDays,
      restockQuantity,
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
      availableAt: body.availableAt ? new Date(body.availableAt) : null,
      restockDate: body.restockDate ? new Date(body.restockDate) : null,
      saleEndDate: body.saleEndDate ? new Date(body.saleEndDate) : null,
      status: 'PENDING',
    };
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
    let resolvedSubCategoryId = null;
    if (body.subCategoryId) {
      const foundSub = await prisma.category.findFirst({
        where: {
          OR: [{ id: body.subCategoryId }, { slug: body.subCategoryId }],
        },
      });
      if (foundSub) resolvedSubCategoryId = foundSub.id;
    }
    const baseSlug =
      slugify(productData.name, { lower: true, strict: true, trim: true }) ||
      `product-${Date.now()}`;
    let slug = baseSlug;
    let counter = 1;
    while (await prisma.product.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }
    const product = await prisma.product.create({
      data: {
        ...productData,
        slug,
        categoryId: resolvedCategory.id,
        subCategoryId: resolvedSubCategoryId,
      },
      include: { category: true, subCategory: true },
    });
    const sideProducts = Array.isArray(body.sideProducts) ? body.sideProducts : [];
    for (let i = 0; i < sideProducts.length; i++) {
      const sp = sideProducts[i];
      const sideId = typeof sp === 'string' ? sp : sp?.productId || sp?.id;
      if (!sideId || sideId === product.id) continue;
      const bundlePrice =
        sp && typeof sp === 'object' && sp.bundlePrice !== undefined && sp.bundlePrice !== ''
          ? parseFloat(sp.bundlePrice)
          : null;
      await prisma.productSide.upsert({
        where: { mainProductId_sideProductId: { mainProductId: product.id, sideProductId: sideId } },
        update: { bundlePrice: Number.isFinite(bundlePrice) ? bundlePrice : null, sortOrder: i },
        create: {
          mainProductId: product.id,
          sideProductId: sideId,
          bundlePrice: Number.isFinite(bundlePrice) ? bundlePrice : null,
          sortOrder: i,
        },
      }).catch(() => {});
    }
    const sizeVariants = Array.isArray(body.sizeVariants) ? body.sizeVariants : [];
    for (const sv of sizeVariants) {
      const sizeName = typeof sv === 'string' ? sv : sv?.size;
      if (!sizeName) continue;
      const sizeStock = typeof sv === 'object' ? parseInt(sv.stock, 10) || 0 : 0;
      const sizeSku = typeof sv === 'object' && sv.sku ? String(sv.sku) : null;
      await prisma.productSize.upsert({
        where: { productId_size: { productId: product.id, size: String(sizeName).slice(0, 60) } },
        update: { stock: sizeStock, sku: sizeSku },
        create: { productId: product.id, size: String(sizeName).slice(0, 60), stock: sizeStock, sku: sizeSku },
      }).catch(() => {});
    }
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
    let effectivePrices = null;
    if (body.prices !== undefined) {
      effectivePrices = normalizePrices(
        body.prices, 
        body.price || existingProduct.price, 
        body.currency || existingProduct.currency
      );
      updateData.prices = effectivePrices;
      if (effectivePrices[0]) {
        updateData.price = effectivePrices[0].amount;
        updateData.currency = effectivePrices[0].currency;
      }
    } else if (body.price !== undefined) {
      updateData.price = parseFloat(body.price);
    }

    // ── Per-currency discount prices ─────────────────────────
    if (body.discountPrices !== undefined) {
      // Use the prices being saved, or fall back to existing product prices
      const pricesForValidation = effectivePrices ||
        (Array.isArray(existingProduct.prices) && existingProduct.prices.length > 0
          ? existingProduct.prices
          : [{ currency: existingProduct.currency || 'ETB', amount: Number(existingProduct.price) }]);
      const normalizedDiscountPrices = normalizeDiscountPrices(body.discountPrices, pricesForValidation);
      updateData.discountPrices = normalizedDiscountPrices.length > 0 ? normalizedDiscountPrices : null;
      // Always derive discountPrice from the primary currency's discount
      // Set to null when no primary discount exists — never leave stale
      const primaryCurrency = updateData.currency || existingProduct.currency || 'ETB';
      const primaryDiscount = normalizedDiscountPrices.find((d) => d.currency === primaryCurrency);
      updateData.discountPrice = primaryDiscount ? primaryDiscount.amount : null;
    } else if (body.discountPrice !== undefined) {
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

    // ── Availability status ─────────────────────────────────
    const VALID_STATUSES = ['AVAILABLE', 'OUT_OF_STOCK_TEMPORARY'];

    // Explicit admin override of availability status
    if (
      body.availabilityStatus !== undefined &&
      typeof body.availabilityStatus === 'string' &&
      VALID_STATUSES.includes(body.availabilityStatus.toUpperCase())
    ) {
      updateData.availabilityStatus = body.availabilityStatus.toUpperCase();
      if (updateData.availabilityStatus === 'OUT_OF_STOCK_TEMPORARY') {
        updateData.outOfStockAt = new Date();
      } else {
        updateData.outOfStockAt = null;
      }
    } else if (body.stock !== undefined) {
      // Auto-derive from stock change
      const newStock = updateData.stock;
      if (newStock <= 0) {
        updateData.availabilityStatus = 'OUT_OF_STOCK_TEMPORARY';
        updateData.outOfStockAt = new Date();
      } else {
        updateData.availabilityStatus = 'AVAILABLE';
        updateData.outOfStockAt = null;
      }
    }

    if (body.autoRestock !== undefined) {
      updateData.autoRestock = Boolean(body.autoRestock);
    }
    if (
      body.restockAfterDays !== undefined &&
      body.restockAfterDays !== null &&
      body.restockAfterDays !== ''
    ) {
      updateData.restockAfterDays = Math.max(
        1,
        parseInt(body.restockAfterDays, 10) || 2
      );
    }
    if (
      body.restockQuantity !== undefined &&
      body.restockQuantity !== null &&
      body.restockQuantity !== ''
    ) {
      updateData.restockQuantity = Math.max(
        1,
        parseInt(body.restockQuantity, 10) || 10
      );
    }

    // ── Stock & arrival countdown dates (optional; empty string clears) ──
    for (const field of ['availableAt', 'restockDate', 'saleEndDate']) {
      if (body[field] !== undefined) {
        updateData[field] =
          body[field] && String(body[field]).trim() !== ''
            ? new Date(body[field])
            : null;
      }
    }
    if (body.estimatedDelivery !== undefined) {
      updateData.estimatedDelivery = body.estimatedDelivery || null;
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

    // ── Side / add-on products (replace set) ────────────────
    if (body.sideProducts !== undefined) {
      const sideProducts = Array.isArray(body.sideProducts) ? body.sideProducts : [];
      await prisma.productSide.deleteMany({ where: { mainProductId: id } });
      for (let i = 0; i < sideProducts.length; i++) {
        const sp = sideProducts[i];
        const sideId = typeof sp === 'string' ? sp : sp?.productId || sp?.id;
        if (!sideId || sideId === id) continue;
        const bundlePrice =
          sp && typeof sp === 'object' && sp.bundlePrice !== undefined && sp.bundlePrice !== ''
            ? parseFloat(sp.bundlePrice)
            : null;
        await prisma.productSide.create({
          data: {
            mainProductId: id,
            sideProductId: sideId,
            bundlePrice: Number.isFinite(bundlePrice) ? bundlePrice : null,
            sortOrder: i,
          },
        }).catch(() => {});
      }
    }

    // ── Per-size stock variants (replace set) ───────────────
    if (body.sizeVariants !== undefined) {
      const sizeVariants = Array.isArray(body.sizeVariants) ? body.sizeVariants : [];
      await prisma.productSize.deleteMany({ where: { productId: id } });
      for (const sv of sizeVariants) {
        const sizeName = typeof sv === 'string' ? sv : sv?.size;
        if (!sizeName) continue;
        const sizeStock = typeof sv === 'object' ? parseInt(sv.stock, 10) || 0 : 0;
        const sizeSku = typeof sv === 'object' && sv.sku ? String(sv.sku) : null;
        await prisma.productSize.create({
          data: { productId: id, size: String(sizeName).slice(0, 60), stock: sizeStock, sku: sizeSku },
        }).catch(() => {});
      }
    }

    const updated = await prisma.product.update({
      where: { id },
      data: updateData,
      include: {
        category: true,
        subCategory: true,
        sideProductLinks: {
          orderBy: { sortOrder: 'asc' },
          include: {
            sideProduct: {
              select: {
                id: true, name: true, slug: true, price: true, currency: true,
                prices: true, discountPrice: true, discountPrices: true,
                stock: true, images: true, availabilityStatus: true,
              },
            },
          },
        },
        sizesList: { orderBy: { size: 'asc' } },
      },
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
// PATCH /api/products/:id/availability — Quick availability toggle (ADMIN ONLY)
// ============================================================
router.patch('/:id/availability', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { availabilityStatus, autoRestock, restockAfterDays, restockQuantity, stock } = req.body;

    const VALID_STATUSES = ['AVAILABLE', 'OUT_OF_STOCK_TEMPORARY'];
    const updateData = {};

    if (
      availabilityStatus !== undefined &&
      typeof availabilityStatus === 'string' &&
      VALID_STATUSES.includes(availabilityStatus.toUpperCase())
    ) {
      updateData.availabilityStatus = availabilityStatus.toUpperCase();
      if (updateData.availabilityStatus === 'OUT_OF_STOCK_TEMPORARY') {
        updateData.outOfStockAt = new Date();
      } else {
        updateData.outOfStockAt = null;
      }
    }

    if (stock !== undefined) {
      updateData.stock = typeof stock === 'string' ? parseInt(stock, 10) : stock;
      // Auto-derive status from stock if no explicit status given
      if (updateData.availabilityStatus === undefined) {
        if (updateData.stock <= 0) {
          updateData.availabilityStatus = 'OUT_OF_STOCK_TEMPORARY';
          updateData.outOfStockAt = new Date();
        } else {
          updateData.availabilityStatus = 'AVAILABLE';
          updateData.outOfStockAt = null;
        }
      }
    }

    if (autoRestock !== undefined) updateData.autoRestock = Boolean(autoRestock);
    if (restockAfterDays !== undefined && restockAfterDays !== null && restockAfterDays !== '') {
      updateData.restockAfterDays = Math.max(1, parseInt(restockAfterDays, 10) || 2);
    }
    if (restockQuantity !== undefined && restockQuantity !== null && restockQuantity !== '') {
      updateData.restockQuantity = Math.max(1, parseInt(restockQuantity, 10) || 10);
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const updated = await prisma.product.update({
      where: { id },
      data: updateData,
      include: { category: true, subCategory: true },
    });

    res.json({
      success: true,
      product: serializeProduct(updated),
      message: 'Availability updated successfully',
    });
  } catch (error) {
    console.error('Error updating product availability:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.status(500).json({ error: 'Failed to update availability' });
  }
});

// ============================================================
// PATCH /api/products/:id/status — Approve / publish toggle (ADMIN ONLY)
// ============================================================
router.patch('/:id/status', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const nextStatus = String(req.body?.status || '').toUpperCase();

    if (!['PENDING', 'PUBLISHED'].includes(nextStatus)) {
      return res.status(400).json({
        error: 'Status must be PENDING or PUBLISHED',
      });
    }

    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const updated = await prisma.product.update({
      where: { id },
      data: { status: nextStatus },
      include: { category: true, subCategory: true },
    });

    res.json({
      success: true,
      product: serializeProduct(updated),
      message:
        nextStatus === 'PUBLISHED'
          ? 'Product published successfully.'
          : 'Product moved back to pending.',
    });
  } catch (error) {
    console.error('Error updating product status:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.status(500).json({ error: 'Failed to update product status' });
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