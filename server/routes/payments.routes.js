/**
 * payments.routes.js
 *
 * Module 3 — checkout payment verification + admin escalation chat.
 *
 * User routes (mounted at /api/payments):
 *   POST /verify                              real-time provider check
 *   POST /verification-requests               escalate to admin
 *   GET  /verification-requests/mine          my tickets
 *   GET  /verification-requests/:id           ticket + messages
 *   POST /verification-requests/:id/messages  reply in thread
 *
 * Admin routes (mounted at /api/admin/payments):
 *   GET   /verification-requests              list tickets (?status=)
 *   PATCH /verification-requests/:id          approve/reject
 *   POST  /verification-requests/:id/messages admin reply
 */
const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { verifyTransactionRef } = require('../services/paymentGateway.service');
const { inspectScreenshot } = require('../services/paymentVerification.service');
const { upload, handleUpload } = require('../middleware/upload');
const { sendTelegramMessage } = require('../lib/telegram');
const { sendEmail } = require('../lib/email');

const router = express.Router();
const adminRouter = express.Router();

const COMMISSION_RATE = () => {
  const n = Number(process.env.AFFILIATE_COMMISSION_RATE);
  return Number.isFinite(n) && n > 0 ? n : 0; // percent, 0 = disabled
};

// ── helpers ────────────────────────────────────────────────────────────
async function findOrderForUser({ orderNumber, orderId, userId, isAdmin }) {
  const where = orderNumber
    ? { orderNumber: String(orderNumber).trim() }
    : { id: String(orderId || '').trim() };
  const order = await prisma.order.findFirst({
    where,
    include: { user: { select: { id: true, email: true, name: true } } },
  });
  if (!order) return { error: 'Order not found.', status: 404 };
  if (!isAdmin && order.userId !== userId) {
    return { error: 'This order does not belong to you.', status: 403 };
  }
  return { order };
}

// Mark order paid + credit affiliate commission (idempotent)
async function markOrderPaid(order, { transactionRef, method, notes }) {
  if (order.paymentStatus === 'PAID' && order.transactionRef === transactionRef) {
    return { alreadyPaid: true };
  }
  const updated = await prisma.order.update({
    where: { id: order.id },
    data: {
      paymentStatus: 'PAID',
      transactionRef: transactionRef || order.transactionRef,
      verificationMethod: method,
      verificationNotes: notes || null,
      verifiedAt: new Date(),
    },
  });

  // Affiliate commission credit
  const rate = COMMISSION_RATE();
  if (rate > 0 && order.affiliateCode && !order.affiliateCommission) {
    try {
      const affiliate = await prisma.user.findUnique({
        where: { affiliateCode: order.affiliateCode },
        select: { id: true, email: true },
      });
      if (affiliate && affiliate.id !== order.userId) {
        const commission = Math.round(Number(order.total) * (rate / 100) * 100) / 100;
        await prisma.rewardTransaction.create({
          data: {
            userId: affiliate.id,
            type: 'CREDIT',
            amount: commission,
            currency: 'ETB',
            source: 'COMMISSION',
            orderId: order.id,
            note: `Affiliate commission (${rate}%) for order ${order.orderNumber}`,
          },
        });
        await prisma.order.update({
          where: { id: order.id },
          data: { affiliateCommission: commission },
        });
      }
    } catch (e) {
      console.error('Affiliate commission credit failed:', e.message);
    }
  }
  return { order: updated, alreadyPaid: false };
}

async function alertAdmins(text) {
  const results = await Promise.allSettled([
    sendTelegramMessage(`💳 Payment verification request\n\n${text}`),
    sendEmail({
      to: process.env.ADMIN_EMAIL || process.env.ADMIN_ALERT_EMAIL || '',
      subject: 'Payment verification request',
      text,
    }).catch(() => null),
  ]);
  return results;
}

// ═══════════════════════════════════════════════════════════
// USER ROUTES
// ═══════════════════════════════════════════════════════════
router.use(requireAuth);

// POST /api/payments/check-ref — pre-order transaction reference check.
// Lets the customer verify a Telebirr/CBE/etc. reference BEFORE placing
// the order. No order is required; only checks provider + duplicates.
router.post('/check-ref', async (req, res) => {
  try {
    const ref = String(req.body?.transactionRef || '').trim();
    if (!ref || ref.length > 120) {
      return res.status(400).json({
        success: false,
        verified: false,
        error: 'Enter a valid transaction reference.',
      });
    }

    // Already used on another order?
    const dup = await prisma.order.findFirst({
      where: { transactionRef: ref },
      select: { orderNumber: true },
    });
    if (dup) {
      return res.status(409).json({
        success: false,
        verified: false,
        code: 'DUPLICATE_RECEIPT',
        error: `This transaction reference was already used for order ${dup.orderNumber}.`,
      });
    }

    const provider = await verifyTransactionRef(ref);
    return res.json({
      success: true,
      verified: provider.verified === true,
      provider: provider.provider,
      reason: provider.reason || null,
      message: provider.verified
        ? 'Transaction verified with the payment provider.'
        : provider.reason === 'provider_not_configured'
          ? 'Online verification is unavailable — your receipt will be reviewed manually after ordering.'
          : 'The provider could not confirm this transaction — you can still place the order and upload your receipt for review.',
    });
  } catch (error) {
    console.error('check-ref error:', error);
    res.status(500).json({ success: false, verified: false, error: 'Verification failed. Please try again.' });
  }
});

// POST /api/payments/verify-screenshot — pre-order OCR check.
// Accepts multipart/form-data with field "screenshot" (image/PDF, max 10MB).
// Returns extracted amount / transaction reference / receipt URLs and the
// stored file URL so the checkout can reuse it as the order's payment proof.
router.post(
  '/verify-screenshot',
  handleUpload(upload.single('screenshot')),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'Please choose a payment screenshot first.',
        });
      }

      // PDFs can't be OCR'd — accept the upload for manual review
      const isPdf =
        req.file.mimetype === 'application/pdf' ||
        /\.pdf$/i.test(req.file.originalname || '');
      if (isPdf) {
        return res.json({
          success: true,
          url: req.file.url || req.file.location || null,
          fileName: req.file.originalname || null,
          extractedAmount: null,
          transactionRef: null,
          receiptUrls: [],
          duplicateOf: null,
          ocrFailed: true,
          message:
            'PDF receipt uploaded — please also attach a screenshot image for automatic verification, ' +
            'or it will be reviewed manually after ordering.',
        });
      }

      let inspection;
      try {
        inspection = await inspectScreenshot(req.file.path);
      } catch (ocrErr) {
        console.error('verify-screenshot OCR error:', ocrErr);
        // OCR unavailable — still accept the upload; admin reviews manually
        return res.json({
          success: true,
          url: req.file.url || req.file.location || null,
          fileName: req.file.originalname || null,
          extractedAmount: null,
          transactionRef: null,
          receiptUrls: [],
          duplicateOf: null,
          ocrFailed: true,
          message:
            'Screenshot uploaded — automatic reading is unavailable right now. ' +
            'Your receipt will be verified manually after ordering.',
        });
      }

      // Duplicate reference check (same protection as post-order verify)
      let duplicateOf = null;
      if (inspection.transactionRef) {
        const dup = await prisma.order.findFirst({
          where: { transactionRef: inspection.transactionRef },
          select: { orderNumber: true },
        });
        if (dup) duplicateOf = dup.orderNumber;
      }

      return res.json({
        success: true,
        url: req.file.url || req.file.location || null,
        fileName: req.file.originalname || null,
        extractedAmount: inspection.amount,
        transactionRef: inspection.transactionRef,
        receiptUrls: inspection.receiptUrls,
        duplicateOf,
        message: inspection.amount
          ? `Receipt read — amount ETB ${inspection.amount.toFixed(2)}${
              inspection.transactionRef ? `, ref ${inspection.transactionRef}` : ''
            }.`
          : 'Receipt uploaded — amount could not be read clearly; it will be reviewed after ordering.',
      });
    } catch (error) {
      console.error('verify-screenshot error:', error);
      res.status(500).json({ success: false, error: 'Verification failed. Please try again.' });
    }
  }
);

// POST /api/payments/verify — real-time provider verification
router.post('/verify', async (req, res) => {
  try {
    const { orderNumber, orderId, transactionRef, receiptUrl } = req.body || {};
    const ref = String(transactionRef || '').trim();
    if (!ref || ref.length > 120) {
      return res.status(400).json({ success: false, error: 'A valid transaction reference is required.' });
    }

    const { order, error, status } = await findOrderForUser({
      orderNumber, orderId, userId: req.user.id, isAdmin: false,
    });
    if (error) return res.status(status).json({ success: false, error });

    // Duplicate transaction ref protection (DB unique + explicit check)
    const dup = await prisma.order.findFirst({
      where: { transactionRef: ref, NOT: { id: order.id } },
      select: { orderNumber: true },
    });
    if (dup) {
      return res.status(409).json({
        success: false,
        verified: false,
        code: 'DUPLICATE_RECEIPT',
        error: `This transaction reference was already used for order ${dup.orderNumber}.`,
      });
    }

    // Real-time provider check
    const provider = await verifyTransactionRef(ref);

    if (provider.verified) {
      await markOrderPaid(order, {
        transactionRef: ref,
        method: 'PROVIDER',
        notes: `Verified via ${provider.provider} at ${new Date().toISOString()}`,
      });
      return res.json({
        success: true,
        verified: true,
        paymentStatus: 'PAID',
        transactionRef: ref,
        provider: provider.provider,
        message: 'Payment verified successfully. Your order is now PAID.',
      });
    }

    // Provider rejected / unavailable → do NOT mark paid; suggest escalation
    return res.status(402).json({
      success: false,
      verified: false,
      paymentStatus: order.paymentStatus || 'UNVERIFIED',
      transactionRef: ref,
      provider: provider.provider,
      reason: provider.reason,
      error:
        provider.reason === 'provider_not_configured'
          ? 'Online verification is unavailable right now. You can request admin verification below.'
          : 'The payment provider could not confirm this transaction. You can request admin verification below.',
      canEscalate: true,
    });
  } catch (error) {
    console.error('Payment verify error:', error);
    res.status(500).json({ success: false, error: 'Verification failed. Please try again.' });
  }
});

// POST /api/payments/verification-requests — escalate to admin
router.post('/verification-requests', async (req, res) => {
  try {
    const { orderNumber, orderId, transactionRef, receiptUrl, message } = req.body || {};
    const ref = String(transactionRef || '').trim();
    if (!ref || ref.length > 120) {
      return res.status(400).json({ success: false, error: 'Transaction reference is required.' });
    }

    const { order, error, status } = await findOrderForUser({
      orderNumber, orderId, userId: req.user.id, isAdmin: false,
    });
    if (error) return res.status(status).json({ success: false, error });

    // Reuse an existing PENDING request for the same order+ref
    let request = await prisma.paymentVerificationRequest.findFirst({
      where: { orderId: order.id, transactionRef: ref, status: 'PENDING' },
    });
    if (!request) {
      request = await prisma.paymentVerificationRequest.create({
        data: {
          orderId: order.id,
          userId: req.user.id,
          transactionRef: ref,
          receiptUrl: receiptUrl ? String(receiptUrl).slice(0, 2048) : null,
        },
      });
      await prisma.paymentVerificationMessage.create({
        data: {
          requestId: request.id,
          senderId: req.user.id,
          senderRole: 'SYSTEM',
          body: `Verification request created for order ${order.orderNumber} (ref: ${ref}).`,
        },
      });
      if (message && String(message).trim()) {
        await prisma.paymentVerificationMessage.create({
          data: {
            requestId: request.id,
            senderId: req.user.id,
            senderRole: 'USER',
            body: String(message).trim().slice(0, 2000),
          },
        });
      }
      // Alert admins
      alertAdmins(
        `Order ${order.orderNumber}\nCustomer: ${order.customerName} <${order.customerEmail}>\nRef: ${ref}\nTotal: ${order.total} ETB`
      ).catch(() => {});
    }

    res.status(201).json({ success: true, request: { id: request.id, status: request.status } });
  } catch (error) {
    console.error('Create verification request error:', error);
    res.status(500).json({ success: false, error: 'Could not create request.' });
  }
});

// GET /api/payments/verification-requests/mine
router.get('/verification-requests/mine', async (req, res) => {
  try {
    const requests = await prisma.paymentVerificationRequest.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        order: { select: { orderNumber: true, total: true } },
        messages: { orderBy: { createdAt: 'asc' }, take: 50 },
      },
    });
    res.json({ success: true, requests });
  } catch (error) {
    console.error('List my verification requests error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// GET /api/payments/verification-requests/:id — owner only
router.get('/verification-requests/:id', async (req, res) => {
  try {
    const request = await prisma.paymentVerificationRequest.findUnique({
      where: { id: req.params.id },
      include: {
        order: { select: { orderNumber: true, total: true, paymentStatus: true } },
        user: { select: { name: true, email: true } },
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!request) return res.status(404).json({ success: false, error: 'Request not found.' });
    const isAdmin = req.user.role === 'ADMIN' || req.user.role === 'SUPER_ADMIN';
    if (!isAdmin && request.userId !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Forbidden.' });
    }
    res.json({ success: true, request });
  } catch (error) {
    console.error('Get verification request error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// POST /api/payments/verification-requests/:id/messages — user reply
router.post('/verification-requests/:id/messages', async (req, res) => {
  try {
    const request = await prisma.paymentVerificationRequest.findUnique({
      where: { id: req.params.id },
    });
    if (!request) return res.status(404).json({ success: false, error: 'Request not found.' });
    if (request.userId !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Forbidden.' });
    }
    if (request.status !== 'PENDING') {
      return res.status(400).json({ success: false, error: 'This request is already resolved.' });
    }
    const body = String(req.body?.body || '').trim().slice(0, 2000);
    if (!body) return res.status(400).json({ success: false, error: 'Message body is required.' });

    const message = await prisma.paymentVerificationMessage.create({
      data: { requestId: request.id, senderId: req.user.id, senderRole: 'USER', body },
    });
    res.status(201).json({ success: true, message });
  } catch (error) {
    console.error('Post verification message error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// ═══════════════════════════════════════════════════════════
// ADMIN ROUTES
// ═══════════════════════════════════════════════════════════
adminRouter.use(requireAuth, requireAdmin);

// GET /api/admin/payments/verification-requests?status=PENDING
adminRouter.get('/verification-requests', async (req, res) => {
  try {
    const status = String(req.query.status || '').toUpperCase();
    const requests = await prisma.paymentVerificationRequest.findMany({
      where: status && ['PENDING', 'APPROVED', 'REJECTED', 'CLOSED'].includes(status)
        ? { status }
        : {},
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        order: { select: { orderNumber: true, total: true, paymentStatus: true, customerName: true, customerEmail: true } },
        user: { select: { name: true, email: true } },
        _count: { select: { messages: true } },
      },
    });
    res.json({ success: true, requests });
  } catch (error) {
    console.error('Admin list verification requests error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// PATCH /api/admin/payments/verification-requests/:id — approve/reject
adminRouter.patch('/verification-requests/:id', async (req, res) => {
  try {
    const request = await prisma.paymentVerificationRequest.findUnique({
      where: { id: req.params.id },
      include: { order: true },
    });
    if (!request) return res.status(404).json({ success: false, error: 'Request not found.' });

    const status = String(req.body?.status || '').toUpperCase();
    if (!['APPROVED', 'REJECTED', 'CLOSED'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status.' });
    }
    const adminNote = req.body?.adminNote ? String(req.body.adminNote).slice(0, 2000) : null;

    const updated = await prisma.paymentVerificationRequest.update({
      where: { id: request.id },
      data: {
        status,
        adminNote,
        resolvedBy: req.user.id,
        resolvedAt: new Date(),
      },
    });

    // On approval → mark the order PAID with the requested transaction ref
    if (status === 'APPROVED') {
      await markOrderPaid(request.order, {
        transactionRef: request.transactionRef,
        method: 'ADMIN',
        notes: adminNote || 'Manually approved by admin',
      });
      await prisma.paymentVerificationMessage.create({
        data: {
          requestId: request.id,
          senderId: req.user.id,
          senderRole: 'SYSTEM',
          body: 'Payment approved by admin — order marked as PAID.',
        },
      });
    } else {
      await prisma.paymentVerificationMessage.create({
        data: {
          requestId: request.id,
          senderId: req.user.id,
          senderRole: 'SYSTEM',
          body: `Request ${status.toLowerCase()}${adminNote ? `: ${adminNote}` : '.'}`,
        },
      });
    }

    res.json({ success: true, request: updated });
  } catch (error) {
    console.error('Admin resolve verification request error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// POST /api/admin/payments/verification-requests/:id/messages — admin reply
adminRouter.post('/verification-requests/:id/messages', async (req, res) => {
  try {
    const request = await prisma.paymentVerificationRequest.findUnique({
      where: { id: req.params.id },
    });
    if (!request) return res.status(404).json({ success: false, error: 'Request not found.' });
    const body = String(req.body?.body || '').trim().slice(0, 2000);
    if (!body) return res.status(400).json({ success: false, error: 'Message body is required.' });

    const message = await prisma.paymentVerificationMessage.create({
      data: { requestId: request.id, senderId: req.user.id, senderRole: 'ADMIN', body },
    });
    res.status(201).json({ success: true, message });
  } catch (error) {
    console.error('Admin post verification message error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

module.exports = { router, adminRouter };
