const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
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
  for (const cat of ARTICLE_CATEGORIES) {
    await prisma.articleCategory.upsert({
      where: { slug: cat.slug },
      update: {},
      create: cat,
    });
  }
  console.log(`✅ Article categories ready: ${ARTICLE_CATEGORIES.length}\n`);
  await prisma.settings.upsert({
    where: { id: 'default-settings' },
    update: {
      siteName: 'Dream More Affiliate Market',
      siteDescription: 'Discover trusted products and great deals.',
      storeName: 'Dream More Affiliate Market',
      currency: 'ETB',
      taxRate: 15,
      themeColor: '#F47822',
    },
    create: {
      id: 'default-settings',
      siteName: 'Dream More Affiliate Market',
      siteDescription: 'Discover trusted products and great deals.',
      adminEmail: 'support@dreammoredigitals.com',
      adminPhone: '+251 993 132 122',
      address: 'Gondar, Ethiopia',
      storeName: 'Dream More Affiliate Market',
      storeEmail: 'info@dreammoredigitals.com',
      storePhone: '+251 993 132 122',
      storeAddress: 'Gondar, Ethiopia',
      currency: 'ETB',
      taxRate: 15,
      themeColor: '#F47822',
      contactEmail: 'support@dreammoredigitals.com',
      contactPhone: '+251 993 132 122',
      contactAddress: 'Gondar, Ethiopia',
      supportEmail: 'support@dreammoredigitals.com',
      infoEmail: 'info@dreammoredigitals.com',
      timezone: 'Africa/Addis_Ababa',
    },
  });
  console.log('✅ Default settings ready\n');
  const articleCategoryCount = await prisma.articleCategory.count();
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎉 SEED COMPLETE!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`   Article categories: ${articleCategoryCount}`);
  console.log('   Settings:           Initialized');
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