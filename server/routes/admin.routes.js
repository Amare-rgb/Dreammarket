// routes/admin.routes.js
const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { requireAdmin } = require('../middleware/auth');
const { sendSms: sendSmsLib } = require('../lib/sms');
const { sendEmail: sendEmailLib } = require('../lib/email');

// ═══════════════════════════════════════════════════════════
// NOTE: Order, OrderItem, Article, Cart, CartItem models were
// REMOVED. This file no longer queries them.
// ═══════════════════════════════════════════════════════════

// ============================================================
// GET /api/admin/users — list all users
// ============================================================
router.get('/users', requireAdmin, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        avatar: true,
        createdAt: true,
      },
    });

    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================================
// PATCH /api/admin/users — update a user's role
// Only USER and ADMIN are valid roles.
// ============================================================
router.patch('/users', requireAdmin, async (req, res) => {
  try {
    const { userId, role } = req.body;

    if (!userId || !role) {
      return res.status(400).json({ error: 'Missing parameters' });
    }

    const normalizedRole = String(role).toUpperCase();
    if (normalizedRole !== 'USER' && normalizedRole !== 'ADMIN') {
      return res.status(400).json({
        error: 'Invalid role. Allowed values: USER, ADMIN',
      });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { role: normalizedRole },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    });

    res.json({ success: true, user: updated });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================================
// GET /api/admin/stats — dashboard overview counts
// Orders removed — only counts that still exist.
// ============================================================
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    const [totalUsers, totalProducts, totalCategories] = await Promise.all([
      prisma.user.count(),
      prisma.product.count(),
      prisma.category.count(),
    ]);

    res.json({
      totalUsers,
      totalProducts,
      totalCategories,
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ═══════════════════════════════════════════════════════════
// LOYALTY & REWARDS
// ═══════════════════════════════════════════════════════════

const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// ── SMS via Africa's Talking (lib/sms.js — real provider) ──
async function sendSms(phone, message) {
  return sendSmsLib({ to: phone, message });
}

// ── Africa's Talking Airtime API (optional top-up fallback) ──
async function sendAirtimeTopup(phone, amount) {
  const apiKey = process.env.AT_API_KEY;
  const username = process.env.AT_USERNAME;
  if (!apiKey || !username) {
    throw new Error('Africa\'s Talking not configured (AT_API_KEY / AT_USERNAME missing).');
  }
  const sandbox = (process.env.AT_SANDBOX || 'true').toLowerCase() !== 'false';
  const host = sandbox ? 'sandbox' : 'api';
  const recipients = [{ recipient: String(phone).replace(/\D/g, ''), amount: String(amount) }];
  const res = await fetch(`https://${host}.africastalking.com/version1/airtime/send`, {
    method: 'POST',
    headers: {
      apiKey,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({
      username,
      recipients: JSON.stringify(recipients),
    }).toString(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.error) {
    throw new Error(data?.error || `Africa's Talking error (${res.status})`);
  }
  return data;
}

// ── Email via Resend → Gmail SMTP fallback (lib/email.js — real provider) ──
async function sendEmail(to, subject, text) {
  const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#20283a;line-height:1.6;">
    <div style="background:#20283a;padding:20px;color:#fff;text-align:center;"><h1 style="margin:0;font-size:20px;">Dream More Affiliate Market</h1></div>
    <div style="padding:24px;background:#fff;white-space:pre-line;">${String(text).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>
  </div>`;
  return sendEmailLib({ to, subject, text, html });
}

const REWARD_SCOPES = ['PRODUCT', 'ALL_ORDERS'];
const TRIGGER_TYPES = ['MIN_QUANTITY', 'MIN_SPEND'];
const REWARD_TYPES = ['FIXED_CASHBACK', 'PERCENT_DISCOUNT', 'FREE_ITEM', 'CUSTOM', 'MOBILE_AIRTIME'];

function normalizeRulePayload(body, { partial = false } = {}) {
  const data = {};
  const pick = (key, fn) => {
    if (body[key] !== undefined) data[key] = fn(body[key]);
  };
  pick('name', (v) => String(v).slice(0, 160));
  pick('description', (v) => (v ? String(v).slice(0, 2000) : null));
  pick('scope', (v) => (REWARD_SCOPES.includes(v) ? v : 'ALL_ORDERS'));
  pick('productId', (v) => (v ? String(v) : null));
  pick('triggerType', (v) => (TRIGGER_TYPES.includes(v) ? v : 'MIN_SPEND'));
  pick('threshold', (v) => {
    const n = toNum(v);
    return n == null ? null : n;
  });
  pick('minSpend', (v) => {
    const n = toNum(v);
    return n == null ? null : n;
  });
  pick('rewardType', (v) => (REWARD_TYPES.includes(v) ? v : 'FIXED_CASHBACK'));
  pick('rewardValue', (v) => String(v).slice(0, 500));
  pick('promoCode', (v) => (v ? String(v).trim().toUpperCase().slice(0, 60) : null));
  pick('expiresAt', (v) => (v ? new Date(v) : null));
  pick('active', (v) => Boolean(v));
  return data;
}

// Auto-create / update a PromoCode row for discount-type rewards
async function syncPromoForRule(rule) {
  if (!rule.promoCode) return null;
  const isDiscount = ['FIXED_CASHBACK', 'PERCENT_DISCOUNT'].includes(rule.rewardType);
  const discountType = rule.rewardType === 'PERCENT_DISCOUNT' ? 'PERCENT' : 'FIXED';
  const discountValue = toNum(rule.rewardValue) || 0;
  const existing = await prisma.promoCode.findUnique({ where: { code: rule.promoCode } });
  const payload = {
    description: `Auto reward: ${rule.name}`,
    discountType,
    discountValue,
    minOrderTotal: null,
    expiresAt: rule.expiresAt || null,
    active: rule.active && isDiscount,
    rewardRuleId: rule.id,
  };
  if (existing) {
    return prisma.promoCode.update({ where: { code: rule.promoCode }, data: payload });
  }
  return prisma.promoCode.create({
    data: { code: rule.promoCode, ...payload },
  });
}

// GET /api/admin/rewards/rules — list reward rules
router.get('/rewards/rules', requireAdmin, async (req, res) => {
  try {
    const rules = await prisma.rewardRule.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        product: { select: { id: true, name: true, slug: true } },
        _count: { select: { dispatches: true } },
      },
    });
    res.json({ success: true, rules });
  } catch (error) {
    console.error('Error fetching reward rules:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// POST /api/admin/rewards/rules — create rule
router.post('/rewards/rules', requireAdmin, async (req, res) => {
  try {
    const body = req.body || {};
    if (!body.name || !body.rewardValue) {
      return res.status(400).json({ success: false, error: 'Name and rewardValue are required.' });
    }
    const data = normalizeRulePayload(body);
    // Backfill threshold from legacy minSpend when not provided
    if (data.threshold == null) {
      data.threshold = data.minSpend != null ? data.minSpend : 0;
    }
    if (data.scope === 'PRODUCT' && !data.productId) {
      return res.status(400).json({ success: false, error: 'productId is required for product-scoped rules.' });
    }
    const rule = await prisma.rewardRule.create({ data });
    await syncPromoForRule(rule).catch((e) => console.warn('Promo sync failed:', e.message));
    const full = await prisma.rewardRule.findUnique({
      where: { id: rule.id },
      include: { product: { select: { id: true, name: true, slug: true } } },
    });
    res.status(201).json({ success: true, rule: full });
  } catch (error) {
    console.error('Error creating reward rule:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// PATCH /api/admin/rewards/rules/:id — update / toggle
router.patch('/rewards/rules/:id', requireAdmin, async (req, res) => {
  try {
    const data = normalizeRulePayload(req.body || {}, { partial: true });
    if (data.scope === 'PRODUCT' && data.productId === undefined) {
      const existing = await prisma.rewardRule.findUnique({ where: { id: req.params.id }, select: { productId: true } });
      if (!existing?.productId) {
        return res.status(400).json({ success: false, error: 'productId is required for product-scoped rules.' });
      }
    }
    const rule = await prisma.rewardRule.update({ where: { id: req.params.id }, data });
    await syncPromoForRule(rule).catch((e) => console.warn('Promo sync failed:', e.message));
    const full = await prisma.rewardRule.findUnique({
      where: { id: rule.id },
      include: { product: { select: { id: true, name: true, slug: true } } },
    });
    res.json({ success: true, rule: full });
  } catch (error) {
    console.error('Error updating reward rule:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// DELETE /api/admin/rewards/rules/:id
router.delete('/rewards/rules/:id', requireAdmin, async (req, res) => {
  try {
    await prisma.rewardRule.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting reward rule:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// GET /api/admin/rewards/progress — users who crossed thresholds
router.get('/rewards/progress', requireAdmin, async (req, res) => {
  try {
    const rules = await prisma.rewardRule.findMany({
      where: { active: true, scope: 'ALL_ORDERS', triggerType: 'MIN_SPEND' },
    });
    // Aggregate delivered/confirmed order totals per user email & userId
    const orders = await prisma.order.findMany({
      where: { status: { not: 'CANCELLED' } },
      select: { userId: true, customerEmail: true, customerName: true, customerPhone: true, total: true, status: true },
    });
    const spendMap = new Map();
    for (const o of orders) {
      const key = o.userId || o.customerEmail.toLowerCase();
      const entry = spendMap.get(key) || {
        userId: o.userId,
        email: o.customerEmail,
        name: o.customerName,
        phone: o.customerPhone,
        totalSpend: 0,
      };
      entry.totalSpend += Number(o.total);
      spendMap.set(key, entry);
    }
    const users = [...spendMap.values()].map((u) => {
      const eligible = rules
        .map((r) => ({ rule: r, limit: Number(r.threshold ?? r.minSpend ?? 0) }))
        .filter(({ limit }) => limit > 0 && u.totalSpend >= limit)
        .map(({ rule: r, limit }) => ({ id: r.id, name: r.name, minSpend: limit, rewardType: r.rewardType, rewardValue: r.rewardValue }));
      return { ...u, totalSpend: Math.round(u.totalSpend * 100) / 100, eligibleRewards: eligible };
    }).sort((a, b) => b.totalSpend - a.totalSpend);

    const dispatches = await prisma.rewardDispatch.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { rewardRule: { select: { name: true } } },
    });

    res.json({ success: true, users, dispatches, rules });
  } catch (error) {
    console.error('Error fetching reward progress:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// POST /api/admin/rewards/dispatch — send reward via SMS/Email
router.post('/rewards/dispatch', requireAdmin, async (req, res) => {
  try {
    const { rewardRuleId, userId, orderId, recipientEmail, recipientPhone, channel, customMessage } = req.body || {};
    const ch = String(channel || 'BOTH').toUpperCase();
    if (!['SMS', 'EMAIL', 'BOTH'].includes(ch)) {
      return res.status(400).json({ success: false, error: 'Channel must be SMS, EMAIL, or BOTH.' });
    }

    let rule = null;
    if (rewardRuleId) {
      rule = await prisma.rewardRule.findUnique({ where: { id: rewardRuleId } });
      if (!rule) return res.status(404).json({ success: false, error: 'Reward rule not found.' });
    }

    // Resolve recipient from user/order if not provided
    let email = recipientEmail ? String(recipientEmail) : null;
    let phone = recipientPhone ? String(recipientPhone) : null;
    if (userId) {
      const u = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, phone: true, name: true } });
      if (u) { email = email || u.email; phone = phone || u.phone; }
    }
    if (orderId) {
      const o = await prisma.order.findUnique({ where: { id: orderId }, select: { customerEmail: true, customerPhone: true, customerName: true } });
      if (o) { email = email || o.customerEmail; phone = phone || o.customerPhone; }
    }

    // ── MOBILE_AIRTIME: resolve a voucher PIN or trigger Airtime API ──
    let airtimeInfo = null;
    if (rule && rule.rewardType === 'MOBILE_AIRTIME') {
      const amount = toNum(rule.rewardValue) || 0;
      if (amount <= 0) {
        return res.status(400).json({ success: false, error: 'Airtime reward amount is invalid.' });
      }
      // Pick an AVAILABLE voucher matching the amount (exact, else nearest lower/higher available)
      let voucher = await prisma.airtimeVoucher.findFirst({
        where: { status: 'AVAILABLE', amount },
        orderBy: { createdAt: 'asc' },
      });
      if (!voucher) {
        voucher = await prisma.airtimeVoucher.findFirst({
          where: { status: 'AVAILABLE' },
          orderBy: { amount: 'asc' },
        });
      }
      if (voucher) {
        voucher = await prisma.airtimeVoucher.update({
          where: { id: voucher.id },
          data: {
            status: 'USED',
            assignedOrderId: orderId || null,
            usedAt: new Date(),
          },
        });
        airtimeInfo = {
          mode: 'PIN',
          pin: voucher.pinCode,
          network: voucher.network || 'mobile',
          amount: Number(voucher.amount),
        };
      } else if (process.env.AT_API_KEY && process.env.AT_USERNAME && phone) {
        // No manual PIN — top up directly via Africa's Talking
        try {
          await sendAirtimeTopup(phone, amount);
          airtimeInfo = { mode: 'API', amount, network: 'mobile' };
        } catch (e) {
          return res.status(502).json({
            success: false,
            error: `No airtime voucher available and API top-up failed: ${e.message}`,
          });
        }
      } else {
        return res.status(400).json({
          success: false,
          error: 'No AVAILABLE airtime voucher matches this reward. Add PINs in Admin → Rewards, or configure AT_API_KEY/AT_USERNAME.',
        });
      }
    }

    const rewardText = customMessage ||
      (rule ? `Reward unlocked: ${rule.name} — ${rule.rewardValue}` : 'Your reward is ready!');
    let message = `DreamMar: ${rewardText}`;
    if (airtimeInfo) {
      message = airtimeInfo.mode === 'PIN'
        ? `DreamMar Airtime: You received ${airtimeInfo.amount} ETB ${airtimeInfo.network} airtime! Recharge PIN: ${airtimeInfo.pin}. Dial *805*${airtimeInfo.pin}# to redeem.`
        : `DreamMar Airtime: ${airtimeInfo.amount} ETB mobile airtime has been sent to your phone. Check your balance.`;
    }

    const results = { sms: null, email: null };
    const errors = [];

    if ((ch === 'SMS' || ch === 'BOTH') && phone) {
      try {
        results.sms = await sendSms(phone, message);
      } catch (e) {
        errors.push(`SMS: ${e.message}`);
        results.sms = { error: e.message };
      }
    }
    if ((ch === 'EMAIL' || ch === 'BOTH') && email) {
      try {
        results.email = await sendEmail(email, 'Your DreamMar Reward', message);
      } catch (e) {
        errors.push(`Email: ${e.message}`);
        results.email = { error: e.message };
      }
    }

    const anySent = (results.sms && !results.sms.error) || (results.email && !results.email.error);
    const dispatch = await prisma.rewardDispatch.create({
      data: {
        rewardRuleId: rule?.id || null,
        userId: userId || null,
        orderId: orderId || null,
        recipientEmail: email,
        recipientPhone: phone,
        channel: ch,
        status: anySent ? 'SENT' : 'FAILED',
        message,
        error: errors.length ? errors.join('; ') : null,
        sentAt: anySent ? new Date() : null,
        sentBy: req.user?.id || null,
      },
    });

    res.status(anySent ? 200 : 502).json({
      success: anySent,
      dispatch,
      results,
      error: anySent ? undefined : (errors.join('; ') || 'No delivery channel succeeded.'),
    });
  } catch (error) {
    console.error('Error dispatching reward:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// ═══════════════════════════════════════════════════════════
// AIRTIME VOUCHERS (manual PIN pool)
// ═══════════════════════════════════════════════════════════

// GET /api/admin/airtime-vouchers
router.get('/airtime-vouchers', requireAdmin, async (req, res) => {
  try {
    const { status, amount } = req.query;
    const where = {};
    if (status) where.status = String(status).toUpperCase();
    if (amount != null && amount !== '') where.amount = Number(amount);
    const vouchers = await prisma.airtimeVoucher.findMany({
      where,
      orderBy: [{ status: 'asc' }, { amount: 'asc' }, { createdAt: 'desc' }],
      take: 500,
    });
    const summary = await prisma.airtimeVoucher.groupBy({
      by: ['amount', 'status'],
      _count: { _all: true },
    });
    res.json({ success: true, vouchers, summary });
  } catch (error) {
    console.error('Error fetching airtime vouchers:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// POST /api/admin/airtime-vouchers/bulk — bulk paste PINs
// body: { amount, network?, pins: "pin1\npin2, pin3" }
router.post('/airtime-vouchers/bulk', requireAdmin, async (req, res) => {
  try {
    const amount = toNum(req.body?.amount);
    const network = req.body?.network ? String(req.body.network).slice(0, 60) : null;
    const rawPins = String(req.body?.pins || '');
    const pins = [...new Set(
      rawPins
        .split(/[\n,;\s]+/)
        .map((p) => p.trim())
        .filter(Boolean)
    )].slice(0, 500);

    if (amount == null || amount <= 0) {
      return res.status(400).json({ success: false, error: 'Provide a valid amount (ETB).' });
    }
    if (pins.length === 0) {
      return res.status(400).json({ success: false, error: 'Provide at least one PIN code.' });
    }

    const created = await prisma.airtimeVoucher.createMany({
      data: pins.map((pinCode) => ({ amount, pinCode: pinCode.slice(0, 60), network })),
    });
    res.status(201).json({ success: true, created: created.count });
  } catch (error) {
    console.error('Error creating airtime vouchers:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// DELETE /api/admin/airtime-vouchers/:id — only AVAILABLE vouchers
router.delete('/airtime-vouchers/:id', requireAdmin, async (req, res) => {
  try {
    const voucher = await prisma.airtimeVoucher.findUnique({ where: { id: req.params.id } });
    if (!voucher) return res.status(404).json({ success: false, error: 'Voucher not found.' });
    if (voucher.status !== 'AVAILABLE') {
      return res.status(400).json({ success: false, error: 'Only AVAILABLE vouchers can be deleted.' });
    }
    await prisma.airtimeVoucher.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting airtime voucher:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// PATCH /api/admin/rewards/dispatch/:id — mark redeemed/failed
router.patch('/rewards/dispatch/:id', requireAdmin, async (req, res) => {
  try {
    const { status } = req.body || {};
    if (!['PENDING', 'SENT', 'FAILED', 'REDEEMED'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status.' });
    }
    const dispatch = await prisma.rewardDispatch.update({
      where: { id: req.params.id },
      data: { status },
    });
    res.json({ success: true, dispatch });
  } catch (error) {
    console.error('Error updating dispatch:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// ═══════════════════════════════════════════════════════════
// PROMO CODES
// ═══════════════════════════════════════════════════════════
router.get('/promo-codes', requireAdmin, async (req, res) => {
  try {
    const codes = await prisma.promoCode.findMany({ orderBy: { createdAt: 'desc' } });
    res.json({ success: true, codes });
  } catch (error) {
    console.error('Error fetching promo codes:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

router.post('/promo-codes', requireAdmin, async (req, res) => {
  try {
    const { code, description, discountType, discountValue, minOrderTotal, expiresAt, usageLimit, active, rewardRuleId } = req.body || {};
    if (!code || toNum(discountValue) == null) {
      return res.status(400).json({ success: false, error: 'Code and discountValue are required.' });
    }
    const promo = await prisma.promoCode.create({
      data: {
        code: String(code).trim().toUpperCase().slice(0, 60),
        description: description ? String(description).slice(0, 500) : null,
        discountType: discountType === 'FIXED' ? 'FIXED' : 'PERCENT',
        discountValue: toNum(discountValue),
        minOrderTotal: toNum(minOrderTotal),
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        usageLimit: toNum(usageLimit) != null ? Math.floor(toNum(usageLimit)) : null,
        active: active !== false,
        rewardRuleId: rewardRuleId || null,
      },
    });
    res.status(201).json({ success: true, promo });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ success: false, error: 'This promo code already exists.' });
    }
    console.error('Error creating promo code:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

router.patch('/promo-codes/:id', requireAdmin, async (req, res) => {
  try {
    const { description, discountType, discountValue, minOrderTotal, expiresAt, usageLimit, active } = req.body || {};
    const data = {};
    if (description !== undefined) data.description = description ? String(description).slice(0, 500) : null;
    if (discountType !== undefined) data.discountType = discountType === 'FIXED' ? 'FIXED' : 'PERCENT';
    if (discountValue !== undefined) {
      const n = toNum(discountValue);
      if (n == null) return res.status(400).json({ success: false, error: 'Invalid discountValue.' });
      data.discountValue = n;
    }
    if (minOrderTotal !== undefined) data.minOrderTotal = toNum(minOrderTotal);
    if (expiresAt !== undefined) data.expiresAt = expiresAt ? new Date(expiresAt) : null;
    if (usageLimit !== undefined) data.usageLimit = toNum(usageLimit) != null ? Math.floor(toNum(usageLimit)) : null;
    if (active !== undefined) data.active = Boolean(active);
    const promo = await prisma.promoCode.update({ where: { id: req.params.id }, data });
    res.json({ success: true, promo });
  } catch (error) {
    console.error('Error updating promo code:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

router.delete('/promo-codes/:id', requireAdmin, async (req, res) => {
  try {
    await prisma.promoCode.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting promo code:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

module.exports = router;