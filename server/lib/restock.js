// lib/restock.js
// Auto-restock scheduler: products marked OUT_OF_STOCK_TEMPORARY with
// autoRestock=true are restocked after `restockAfterDays` days.
const prisma = require('./prisma');

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // check every hour
let timer = null;

async function runRestockCheck() {
  try {
    const now = new Date();
    const candidates = await prisma.product.findMany({
      where: {
        availabilityStatus: 'OUT_OF_STOCK_TEMPORARY',
        autoRestock: true,
        outOfStockAt: { not: null },
      },
      select: {
        id: true,
        name: true,
        stock: true,
        outOfStockAt: true,
        restockAfterDays: true,
        restockQuantity: true,
      },
    });

    for (const product of candidates) {
      const days = product.restockAfterDays || 2;
      const dueAt = new Date(product.outOfStockAt.getTime() + days * 24 * 60 * 60 * 1000);
      if (now >= dueAt) {
        const qty = Math.max(1, product.restockQuantity || 10);
        await prisma.product.update({
          where: { id: product.id },
          data: {
            stock: { increment: qty },
            availabilityStatus: 'AVAILABLE',
            outOfStockAt: null,
          },
        });
        console.log(
          `🔄 Auto-restocked "${product.name}" (+${qty} units) after ${days} day(s) out of stock`
        );
      }
    }
  } catch (error) {
    console.error('❌ Auto-restock check failed:', error.message);
  }
}

function startRestockScheduler() {
  if (timer) return;
  // Run once shortly after boot, then hourly.
  setTimeout(() => {
    void runRestockCheck();
    timer = setInterval(() => void runRestockCheck(), CHECK_INTERVAL_MS);
    timer.unref?.();
  }, 30 * 1000);
  console.log('⏰ Auto-restock scheduler started (checks hourly)');
}

module.exports = { startRestockScheduler, runRestockCheck };
