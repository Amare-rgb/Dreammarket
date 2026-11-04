// routes/admin.dashboard.js
const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// ═══════════════════════════════════════════════════════════
// Dashboard overview for marketplace products, customers, orders, and articles.
// ═══════════════════════════════════════════════════════════

// ============================================================
// GET /api/admin/dashboard — Main dashboard stats
// ============================================================
router.get('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    console.log('🔍 Fetching dashboard data...');

    // ---------------------------------------------------------
    // 1. BASIC COUNTS
    // ---------------------------------------------------------
    const [totalProducts, totalCustomers, availableTables] = await Promise.all([
      prisma.product.count(),
      prisma.user.count({ where: { role: 'USER' } }),
      prisma.$queryRaw`
        SELECT
          to_regclass('public.orders') IS NOT NULL AS "orders",
          to_regclass('public.articles') IS NOT NULL AS "articles"
      `,
    ]);

    const tables = availableTables[0];
    const [orderCounts, totalArticles] = await Promise.all([
      tables.orders
        ? prisma.$queryRaw`
            SELECT
              COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE status = 'PENDING')::int AS pending,
              COALESCE(
                SUM(total) FILTER (WHERE status <> 'CANCELLED'),
                0
              )::float8 AS revenue
            FROM public.orders
          `
        : Promise.resolve(null),
      tables.articles
        ? prisma.$queryRaw`SELECT COUNT(*)::int AS total FROM public.articles`
        : Promise.resolve(null),
    ]);
    const totalOrders = orderCounts?.[0]?.total ?? null;
    const pendingOrders = orderCounts?.[0]?.pending ?? null;
    const salesRevenue =
      orderCounts === null ? null : Number(orderCounts[0]?.revenue ?? 0);
    const articleCount = totalArticles?.[0]?.total ?? null;
    const unavailableStats = [
      ...(!tables.orders ? ['orders', 'pendingOrders'] : []),
      ...(!tables.articles ? ['articles'] : []),
    ];

    // ---------------------------------------------------------
    // 2. RECENT PRODUCTS (last 5, newest first)
    // ---------------------------------------------------------
    const recentProducts = await prisma.product.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        price: true,
        discountPrice: true,
        stock: true,
        sku: true,
        images: true, // String[] — image URLs
        createdAt: true,
        category: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    // ---------------------------------------------------------
    // 3. FORMAT RECENT PRODUCTS
    // ---------------------------------------------------------
    const formattedRecentProducts = recentProducts.map((p) => ({
      id: p.id,
      name: p.name,
      price: Number(p.price || 0),
      discountPrice: p.discountPrice ? Number(p.discountPrice) : null,
      stock: typeof p.stock === 'number' ? p.stock : 0,
      sku: p.sku,
      images: Array.isArray(p.images) ? p.images : [],
      category: p.category
        ? { name: p.category.name, slug: p.category.slug }
        : null,
      createdAt: p.createdAt,
    }));

    console.log(
      `📊 Dashboard data fetched (${totalProducts} products, ${totalCustomers} customers, ${formattedRecentProducts.length} recent)`
    );

    // ---------------------------------------------------------
    // 4. RESPONSE
    // ---------------------------------------------------------
    res.json({
      success: true,
      stats: {
        products: totalProducts,
        customers: totalCustomers,
        orders: totalOrders,
        pendingOrders,
        salesRevenue,
        articles: articleCount,
      },
      unavailableStats,
      recentProducts: formattedRecentProducts,
    });
  } catch (error) {
    console.error('❌ Dashboard API Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard data',
      message:
        process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

module.exports = router;