// lib/email.js
const nodemailer = require('nodemailer');

// ═══════════════════════════════════════════════════════════
// Email — Dream More Affiliate Market
//  • Provider: Resend (preferred) or SMTP (fallback)
// ═══════════════════════════════════════════════════════════

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT || '587', 10),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 15000,
});

const stripSlash = (s) => String(s || '').trim().replace(/\/+$/, '');

const BRAND = {
  name: 'Dream More Affiliate Market',
  shortName: 'Dream More',
  tagline: 'Right work at right time',
  supportEmail:
    process.env.SUPPORT_EMAIL ||
    process.env.EMAIL_FROM ||
    'support@alemayehplastic.com',
  website:
    stripSlash(
      process.env.SITE_URL ||
        process.env.FRONTEND_URL ||
        process.env.CLIENT_URL ||
        process.env.NEXT_PUBLIC_SITE_URL
    ) || 'http://localhost:3000',
};

// Escape user-provided text before putting it inside HTML
const escapeHtml = (value) =>
  String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

// ============================================================
// sendEmail — one generic function used by all emails
// ============================================================
async function sendEmail({ to, subject, html, text }) {
  if (!to) throw new Error('sendEmail: "to" is required');

  const resendKey = process.env.RESEND_API_KEY;

  // ---------- Option 1: Resend over HTTPS (recommended) ----------
  if (resendKey) {
    if (typeof fetch !== 'function') {
      throw new Error('Global fetch is not available. Use Node.js 18 or newer.');
    }

    const from =
      process.env.RESEND_FROM ||
      `${BRAND.shortName} <onboarding@resend.dev>`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: [to],
          subject,
          html,
          text,
        }),
        signal: controller.signal,
      });

      const body = await response.text();

      if (!response.ok) {
        throw new Error(`Resend API error ${response.status}: ${body}`);
      }

      try {
        return JSON.parse(body);
      } catch {
        return { ok: true };
      }
    } catch (err) {
      if (err && err.name === 'AbortError') {
        throw new Error('Resend API request timed out after 15s');
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  // ---------- Option 2: SMTP fallback (local development) ----------
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    throw new Error(
      'No email provider configured. Set RESEND_API_KEY (recommended) or EMAIL_USER and EMAIL_PASSWORD.'
    );
  }

  return transporter.sendMail({
    from: `"${BRAND.name}" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
    to,
    subject,
    text,
    html,
  });
}

// ============================================================
// sendWelcomeEmail — welcome notification
// ============================================================
async function sendWelcomeEmail(email, name) {
  const shopUrl = `${BRAND.website}/products`;
  const year = new Date().getFullYear();
  const safeName = escapeHtml(name || 'there');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Welcome to ${BRAND.name}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #1a1a1a; background: #f7f5ef; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 24px 16px; }
        .card { background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 8px 24px rgba(224,168,60,0.10); }
        .header { background: linear-gradient(135deg, #1a1a1a, #2b2b2b 50%, #3a3a3a); padding: 36px 24px 32px; text-align: center; }
        .header .logo-mark { display: inline-flex; align-items: center; justify-content: center; width: 56px; height: 56px; border-radius: 16px; background: #e0a83c; color: #1a1a1a; font-size: 28px; font-weight: 800; margin-bottom: 12px; }
        .header h1 { color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; }
        .header p { color: rgba(224,168,60,0.85); margin: 8px 0 0; font-size: 13px; }
        .content { padding: 32px 28px; }
        .content h2 { color: #1a1a1a; margin: 0 0 12px; font-size: 20px; }
        .content p { color: #555555; margin: 0 0 14px; font-size: 15px; }
        .cta { display: block; width: 100%; text-align: center; background: #e0a83c; color: #1a1a1a !important; padding: 16px 24px; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 16px; margin: 26px 0 12px; }
        .divider { height: 1px; background: #efe9db; margin: 28px 0; }
        .feature-list { list-style: none; padding: 0; margin: 0; }
        .feature-list li { display: flex; align-items: flex-start; gap: 10px; color: #555555; font-size: 14px; margin: 10px 0; }
        .feature-list .dot { flex-shrink: 0; width: 18px; height: 18px; border-radius: 50%; background: #e0a83c; color: #1a1a1a; display: inline-flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 800; margin-top: 2px; }
        .footer { text-align: center; padding: 24px 16px 8px; font-size: 12px; color: #8a8a8a; }
        .footer a { color: #b8842e; text-decoration: none; font-weight: 600; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="card">
          <div class="header">
            <div class="logo-mark">🏭</div>
            <h1>${BRAND.name}</h1>
            <p>${BRAND.tagline}</p>
          </div>

          <div class="content">
            <h2>Welcome aboard, ${safeName}! 🎉</h2>

            <p>
              Thank you for creating an account with
              <strong>${BRAND.name}</strong>, a digital marketplace for
              discovering products and exploring listings.
            </p>

            <p>
              Your account is ready. You can log in right now and start
              exploring the marketplace.
            </p>

            <a href="${shopUrl}" class="cta">
              Browse products →
            </a>

            <div class="divider"></div>

            <p style="font-weight:600; color:#1a1a1a; margin-bottom:8px;">
              What you can do now:
            </p>
            <ul class="feature-list">
              <li><span class="dot">✓</span><span>Browse products from a range of categories</span></li>
              <li><span class="dot">✓</span><span>Review product details and availability</span></li>
              <li><span class="dot">✓</span><span>Contact our team if you need help with shopping</span></li>
            </ul>

            <div class="divider"></div>

            <p style="font-size:13px; color:#777777;">
              Need help? Reply to this email or reach us at
              <a href="mailto:${BRAND.supportEmail}" style="color:#b8842e; font-weight:600;">${BRAND.supportEmail}</a>.
            </p>

            <p style="font-size:13px; color:#8a8a8a;">
              — The ${BRAND.name} Team
            </p>
          </div>
        </div>

        <div class="footer">
          <p>© ${year} ${BRAND.name}. All rights reserved.</p>
          <p style="margin-top:8px;">
            This is an automated message — please do not reply directly.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
Welcome aboard, ${name || 'there'}!

Thank you for creating an account with ${BRAND.name}, a digital marketplace
for discovering products and exploring listings.

Your account is ready. You can log in right now and start exploring:

    ${shopUrl}

What you can do now:
  - Browse products from a range of categories
  - Review product details and availability
  - Contact our team if you need help with shopping

Need help? Contact us at ${BRAND.supportEmail}.

— The ${BRAND.name} Team
© ${year} ${BRAND.name}
  `.trim();

  return sendEmail({
    to: email,
    subject: `Welcome to ${BRAND.name} 🏭`,
    text,
    html,
  });
}

async function sendOrderApprovalEmail(order) {
  if (!order || !order.customerEmail) {
    throw new Error('sendOrderApprovalEmail: order customer email is required');
  }

  const safeName = escapeHtml(order.customerName || 'there');
  const safeOrderNumber = escapeHtml(order.orderNumber);
  const items = (order.items || []).map((item) => {
    const quantity = Number(item.quantity) || 0;
    const unitPrice = Number(item.unitPrice) || 0;
    const lineTotal = new Intl.NumberFormat('en-ET', {
      style: 'currency',
      currency: 'ETB',
      maximumFractionDigits: 2,
    }).format(unitPrice * quantity);
    return {
      html: `<li style="margin:8px 0;">${escapeHtml(item.productName)} × ${quantity} — ${lineTotal}</li>`,
      text: `- ${item.productName} x ${quantity}: ETB ${(unitPrice * quantity).toFixed(2)}`,
    };
  });
  const total = new Intl.NumberFormat('en-ET', {
    style: 'currency',
    currency: 'ETB',
    maximumFractionDigits: 2,
  }).format(Number(order.total) || 0);
  const safeAddress = escapeHtml(order.shippingAddress || '');
  const ordersUrl = `${BRAND.website}/orders`;

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#20283a;line-height:1.6;">
      <div style="background:#20283a;padding:24px;color:#fff;text-align:center;">
        <h1 style="margin:0;">${BRAND.name}</h1>
      </div>
      <div style="padding:24px;background:#fff;">
        <h2>Your order is confirmed</h2>
        <p>Hello ${safeName},</p>
        <p>Your order <strong>${safeOrderNumber}</strong> has been approved and confirmed. We will prepare it for delivery.</p>
        <h3>Order summary</h3>
        <ul style="padding-left:20px;">${items.map((item) => item.html).join('')}</ul>
        <p><strong>Order total: ${total}</strong></p>
        <p><strong>Delivery address:</strong><br>${safeAddress}</p>
        <p style="text-align:center;margin:28px 0;">
          <a href="${ordersUrl}" style="display:inline-block;padding:12px 20px;background:#f47822;color:#20283a;text-decoration:none;border-radius:8px;font-weight:bold;">View your orders</a>
        </p>
        <p>If you have questions, contact our support team.</p>
      </div>
    </div>`;
  const text = [
    `Hello ${order.customerName || 'there'},`,
    '',
    `Your order ${order.orderNumber} has been approved and confirmed.`,
    '',
    'Order summary:',
    ...items.map((item) => item.text),
    `Order total: ETB ${(Number(order.total) || 0).toFixed(2)}`,
    `Delivery address: ${order.shippingAddress || ''}`,
    '',
    `View your orders: ${ordersUrl}`,
    '',
    `— ${BRAND.name}`,
  ].join('\n');

  return sendEmail({
    to: order.customerEmail,
    subject: `Order ${order.orderNumber} confirmed`,
    text,
    html,
  });
}

module.exports = {
  sendWelcomeEmail,
  sendOrderApprovalEmail,
  sendEmail,
  transporter,
};