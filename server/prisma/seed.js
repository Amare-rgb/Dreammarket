// prisma/seed.js
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@dreammar.com').trim().toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin@123';
const ADMIN_NAME = process.env.ADMIN_NAME || 'Dream More Admin';
const ADMIN_PHONE = process.env.ADMIN_PHONE || '+251 993 132 122';

const USER_EMAIL = 'user@alemayehplastic.com';
const USER_PASSWORD = 'user@123';

const ARTICLE_CATEGORIES = [
  { name: 'General', slug: 'general' },
  { name: 'News', slug: 'news' },
  { name: 'Announcements', slug: 'announcements' },
  { name: 'Guides', slug: 'guides' },
  { name: 'Tips', slug: 'tips' },
  { name: 'Events', slug: 'events' },
];

async function main() {
  console.log('🌱 Seeding Dream More Affiliate Market...\n');

  // ========================================
  // 1. ADMIN USER
  // ========================================
  const adminPassword = await bcrypt.hash(ADMIN_PASSWORD, 12);

  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {
      password: adminPassword,
      role: 'ADMIN',
      name: ADMIN_NAME,
      phone: ADMIN_PHONE,
    },
    create: {
      name: ADMIN_NAME,
      email: ADMIN_EMAIL,
      password: adminPassword,
      role: 'ADMIN',
      phone: ADMIN_PHONE,
      address: 'Bahir Dar, Ethiopia',
    },
  });

  console.log('✅ Admin user ready');
  console.log(`   Email: ${admin.email}\n`);

  // ========================================
  // 2. REGULAR USER
  // ========================================
  const userPassword = await bcrypt.hash(USER_PASSWORD, 12);

  const user = await prisma.user.upsert({
    where: { email: USER_EMAIL },
    update: {
      password: userPassword,
      role: 'USER',
      name: 'Test Customer',
    },
    create: {
      name: 'Test Customer',
      email: USER_EMAIL,
      password: userPassword,
      role: 'USER',
      phone: '+251 911 000 000',
      address: 'Bahir Dar, Ethiopia',
    },
  });

  console.log('✅ Regular user ready');
  console.log(`   Email: ${user.email}\n`);

  // ========================================
  // 3. PRODUCT CATEGORIES
  // ========================================
  // Add your real categories here later, or create them from the admin dashboard.
  const categories = [];
  const categoryMap = {};

  for (const cat of categories) {
    const created = await prisma.category.upsert({
      where: { slug: cat.slug },
      update: { name: cat.name, description: cat.description, icon: cat.icon },
      create: { ...cat, createdBy: admin.id },
    });
    categoryMap[cat.slug] = created.id;
  }

  console.log(`✅ Product categories seeded: ${categories.length}\n`);

  // ========================================
  // 4. PRODUCTS
  // ========================================
  // Add your real products here later, or create them from the admin dashboard.
  const products = [];
  let productCount = 0;

  for (const p of products) {
    const categoryId = categoryMap[p.categorySlug];
    if (!categoryId) continue;

    const existing = await prisma.product.findUnique({ where: { sku: p.sku } });
    if (existing) {
      console.log(`⏭️  Already exists: ${p.name}`);
      continue;
    }

    await prisma.product.create({
      data: {
        name: p.name,
        slug: p.slug,
        description: p.description,
        price: p.price,
        discountPrice: p.discountPrice ?? null,
        stock: p.stock,
        sku: p.sku,
        images: p.images,
        categoryId,
        brand: p.brand,
        unitOfMeasurement: p.unitOfMeasurement,
        tags: [],
      },
    });
    console.log(`✅ Created product: ${p.name}`);
    productCount++;
  }

  console.log(`✅ Products seeded: ${productCount}\n`);

  // ========================================
  // 5. ARTICLE CATEGORIES
  // ========================================
  for (const cat of ARTICLE_CATEGORIES) {
    await prisma.articleCategory.upsert({
      where: { slug: cat.slug },
      update: {},
      create: cat,
    });
  }

  console.log(`✅ Article categories ready: ${ARTICLE_CATEGORIES.length}\n`);

  // ========================================
  // 6. SETTINGS
  // ========================================
  await prisma.settings.upsert({
    where: { id: 'default-settings' },
    update: {
      siteName: 'Dream More Affiliate Market',
      siteDescription: 'Discover trusted products and great deals.',
      adminEmail: ADMIN_EMAIL,
      storeName: 'Dream More Affiliate Market',
      storeEmail: 'info@alemayehplastic.com',
      currency: 'ETB',
      taxRate: 15,
      themeColor: '#F47822',
    },
    create: {
      id: 'default-settings',
      siteName: 'Dream More Affiliate Market',
      siteDescription: 'Discover trusted products and great deals.',
      adminEmail: ADMIN_EMAIL,
      adminPhone: ADMIN_PHONE,
      address: 'Bahir Dar, Ethiopia',
      storeName: 'Dream More Affiliate Market',
      storeEmail: 'info@alemayehplastic.com',
      storePhone: '+251 993 132 122',
      storeAddress: 'Bahir Dar, Ethiopia',
      currency: 'ETB',
      taxRate: 15,
      themeColor: '#F47822',
      contactEmail: 'support@alemayehplastic.com',
      contactPhone: '+251 993 132 122',
      contactAddress: 'Bahir Dar, Ethiopia',
      supportEmail: 'support@alemayehplastic.com',
      infoEmail: 'info@alemayehplastic.com',
      timezone: 'Africa/Addis_Ababa',
    },
  });

  console.log('✅ Settings ready\n');

  // ========================================
  // 7. SUMMARY
  // ========================================
  const userCount = await prisma.user.count();
  const categoryCount = await prisma.category.count();
  const productCnt = await prisma.product.count();
  const articleCategoryCount = await prisma.articleCategory.count();

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎉 SEED COMPLETE!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`   Users:               ${userCount}`);
  console.log(`   Product categories:  ${categoryCount}`);
  console.log(`   Products:            ${productCnt}`);
  console.log(`   Article categories:  ${articleCategoryCount}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔐 LOGIN:');
  console.log(`   Admin → ${ADMIN_EMAIL} / (ADMIN_PASSWORD from .env)`);
  console.log(`   User  → ${USER_EMAIL} / ${USER_PASSWORD}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });