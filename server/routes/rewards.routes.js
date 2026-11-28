const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const toNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};
router.get('/me', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    const [rules, orders, dispatches] = await Promise.all([
      prisma.rewardRule.findMany({
        where: { active: true },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          description: true,
          scope: true,
          productId: true,
          triggerType: true,
          threshold: true,
          rewardType: true,
          rewardValue: true,
          promoCode: true,
          expiresAt: true,
          product: { select: { id: true, name: true } },
        },
      }),
      prisma.order.findMany({
        where: {
          userId,
          status: { not: 'CANCELLED' },
        },
        select: {
          id: true,
          orderNumber: true,
          total: true,
          rewardQualified: true,
          createdAt: true,
          qualifiedRule: {
            select: {
              id: true,
              name: true,
              rewardType: true,
              rewardValue: true,
              promoCode: true,
            },
          },
          items: {
            select: {
              productId: true,
              quantity: true,
              product: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.rewardDispatch.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          channel: true,
          status: true,
          message: true,
          sentAt: true,
          createdAt: true,
          rewardRule: { select: { id: true, name: true, rewardValue: true } },
        },
      }),
    ]);

    const totalSpend = orders.reduce((sum, o) => sum + (toNumber(o.total) || 0), 0);

    const rulesWithProgress = rules.map((rule) => {
      const threshold = toNumber(rule.threshold) || 0;
      let progress = 0;
      let qualified = false;

      if (rule.scope === 'PRODUCT' && rule.productId) {
        const qty = orders.reduce((sum, o) => {
          const match = o.items.find((i) => i.productId === rule.productId);
          return sum + (match ? match.quantity : 0);
        }, 0);
        progress = rule.triggerType === 'MIN_QUANTITY' ? qty : 0;
        qualified = rule.triggerType === 'MIN_QUANTITY'
          ? qty >= threshold
          : orders.some((o) =>
              o.items.some((i) => i.productId === rule.productId) &&
              (toNumber(o.total) || 0) >= threshold
            );
      } else {
        if (rule.triggerType === 'MIN_QUANTITY') {
          progress = orders.reduce((sum, o) => sum + o.items.reduce((s, i) => s + i.quantity, 0), 0);
        } else {
          progress = totalSpend;
        }
        qualified = progress >= threshold;
      }

      const pct = threshold > 0 ? Math.min(100, Math.round((progress / threshold) * 100)) : 0;

      return {
        id: rule.id,
        name: rule.name,
        description: rule.description,
        scope: rule.scope,
        triggerType: rule.triggerType,
        threshold,
        rewardType: rule.rewardType,
        rewardValue: rule.rewardValue,
        promoCode: rule.promoCode,
        expiresAt: rule.expiresAt,
        product: rule.product,
        progress: Math.round(progress * 100) / 100,
        percent: pct,
        qualified,
      };
    });

    const qualifiedOrders = orders
      .filter((o) => o.rewardQualified && o.qualifiedRule)
      .map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        total: o.total,
        createdAt: o.createdAt,
        rule: o.qualifiedRule,
      }));

    res.json({
      success: true,
      totalSpend: Math.round(totalSpend * 100) / 100,
      rules: rulesWithProgress,
      qualifiedOrders,
      dispatches,
    });
  } catch (error) {
    console.error('Error fetching user rewards:', error);
    res.status(500).json({ success: false, error: 'Failed to load rewards.' });
  }
});

router.get('/me/wallet', requireAuth, async (req, res) => {
  try {
    const transactions = await prisma.rewardTransaction.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        product: { select: { id: true, name: true } },
        review: { select: { id: true, rating: true } },
        order: { select: { id: true, orderNumber: true } },
      },
    });

    const balance = {};
    for (const tx of transactions) {
      const cur = tx.currency || 'ETB';
      const amt = Number(tx.amount) || 0;
      balance[cur] = (balance[cur] || 0) + (tx.type === 'CREDIT' ? amt : -amt);
    }
    for (const cur of Object.keys(balance)) {
      balance[cur] = Math.round(balance[cur] * 100) / 100;
    }

    res.json({
      success: true,
      balance,
      transactions: transactions.map((tx) => ({
        id: tx.id,
        type: tx.type,
        amount: Number(tx.amount),
        currency: tx.currency,
        source: tx.source,
        note: tx.note,
        createdAt: tx.createdAt,
        product: tx.product,
        review: tx.review,
        order: tx.order,
      })),
    });
  } catch (error) {
    console.error('Error fetching reward wallet:', error);
    res.status(500).json({ success: false, error: 'Failed to load wallet.' });
  }
});

module.exports = router;
