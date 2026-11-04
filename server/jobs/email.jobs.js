// lib/email.js
const nodemailer = require('nodemailer');

// ═══════════════════════════════════════════════════════════
// Email — Dream More Affiliate Market
//  • Provider: Resend (preferred) or SMTP (fallback)
//  • No order/order-related emails (Order model removed)
// ═══════════════════════════════════════════════════════════

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

// ── SMTP transporter (lazy) ────────────────────────────────
let transporter = null;

const getTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
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
  }
  return transporter;
};

// ── Escape user-provided text ──────────────────────────────
const escapeHtml = (value) =>
  String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

// ── Shared layout ──────────────────────────────────────────
const wrapEmail = ({ heading, bodyHtml }) => {
  const year = new Date().getFullYear();
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #1a1a1a; background: #f7f5ef; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 24px 16px; }
    .card { background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 8px 24px rgba(224,168,60,0.10); }
    .header { background: linear-gradient(135deg, #1a1a1a, #2b2b2b 50%, #3a3a3a); padding: 32px 24px 28px; text-align: center; }
    .header .logo-mark { display: inline-flex; align-items: center; justify-content: center; width: 56px; height: 56px; border-radius: 16px; background: #e0a83c; color: #1a1a1a; font-size: 28px; margin-bottom: 12px; }
    .header h1 { color: #ffffff; margin: 0; font-size: 22px; font-weight: 700; }
    .header p { color: rgba(224,168,60,0.85); margin: 8px 0 0; font-size: 13px; }
    .content { padding: 32px 28px; color: #555555; }
    .content h2 { color: #1a1a1a; margin: 0 0 14px; font-size: 19px; }
    .content p { margin: 0 0 14px; font-size: 15px; }
    .cta { display: inline-block; background: #e0a83c; color: #1a1a1a !important; padding: 14px 28px; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 15px; margin: 16px 0; }
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
        <h2>${heading}</h2>
        ${bodyHtml}
      </div>
    </div>
    <div class="footer">
      <p>© ${year} ${BRAND.name}. All rights reserved.</p>
      <p style="margin-top:8px;">This is an automated message — please do not reply directly.</p>
    </div>
  </div>
</body>
</html>`;
};

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
        body: JSON.stringify({ from, to: [to], subject, html, text }),
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

  return getTransporter().sendMail({
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
  const productsUrl = `${BRAND.website}/products`;
  const safeName = escapeHtml(name || 'there');

  const html = wrapEmail({
    heading: `Welcome aboard, ${safeName}! 🎉`,
    bodyHtml: `
      <p>
        Thank you for creating an account with
        <strong>${BRAND.name}</strong>, a digital marketplace for
        discovering products and exploring listings.
      </p>
      <p>Your account is ready. Start exploring the digital marketplace:</p>
      <p style="text-align:center;">
        <a href="${productsUrl}" class="cta">Browse products →</a>
      </p>
      <p style="font-weight:600; color:#1a1a1a; margin-top:24px; margin-bottom:8px;">
        What you can do now:
      </p>
      <ul style="padding-left:20px; color:#555555;">
        <li>Browse products from a range of categories</li>
        <li>Review product details and availability</li>
        <li>Contact our team if you need help with shopping</li>
      </ul>
      <p style="font-size:13px; color:#777777; margin-top:24px;">
        Need help? Reply to this email or reach us at
        <a href="mailto:${BRAND.supportEmail}" style="color:#b8842e; font-weight:600;">${BRAND.supportEmail}</a>.
      </p>
    `,
  });

  const text = `
Welcome aboard, ${name || 'there'}!

Thank you for creating an account with ${BRAND.name}, a digital marketplace
for discovering products and exploring listings.

Your account is ready. Explore the digital marketplace:

    ${productsUrl}

What you can do now:
  - Browse products from a range of categories
  - Review product details and availability
  - Contact our team if you need help with shopping

Need help? Contact us at ${BRAND.supportEmail}.

— The ${BRAND.name} Team
  `.trim();

  return sendEmail({
    to: email,
    subject: `Welcome to ${BRAND.name} 🏭`,
    text,
    html,
  });
}

// ============================================================
// sendPasswordResetEmail — sends a reset link
// ============================================================
async function sendPasswordResetEmail(email, name, resetToken) {
  const resetUrl = `${BRAND.website}/reset-password?token=${encodeURIComponent(
    resetToken
  )}`;
  const safeName = escapeHtml(name || 'there');

  const html = wrapEmail({
    heading: `Hello ${safeName}!`,
    bodyHtml: `
      <p>
        We received a request to reset the password for your
        ${BRAND.name} account.
      </p>
      <p>Click the button below to choose a new password:</p>
      <p style="text-align:center;">
        <a href="${resetUrl}" class="cta">Reset password →</a>
      </p>
      <p style="font-size:13px; color:#777777;">
        This link expires in <strong>1 hour</strong>.
      </p>
      <p style="font-size:13px; color:#777777;">
        If you didn't request this, you can safely ignore this email —
        your password will stay unchanged.
      </p>
    `,
  });

  const text = `
Hello ${name || 'there'}!

We received a request to reset the password for your ${BRAND.name}
account.

Open this link to choose a new password (expires in 1 hour):

    ${resetUrl}

If you didn't request this, ignore this email — your password will
stay unchanged.

— The ${BRAND.name} Team
  `.trim();

  return sendEmail({
    to: email,
    subject: `Reset your ${BRAND.shortName} password`,
    text,
    html,
  });
}

// ============================================================
// sendVerificationEmail — optional, for future OTP flow
// ============================================================
async function sendVerificationEmail(email, name, otp) {
  const safeName = escapeHtml(name || 'there');
  const safeOtp = escapeHtml(otp || '');

  const html = wrapEmail({
    heading: `Verify your email, ${safeName}`,
    bodyHtml: `
      <p>
        Thank you for registering with <strong>${BRAND.name}</strong>.
        Enter the code below to verify your email address:
      </p>
      <div style="font-size:32px; font-weight:800; color:#b8842e; text-align:center; padding:20px; background:#faf7f0; border-radius:10px; margin:20px 0; letter-spacing:8px;">
        ${safeOtp}
      </div>
      <p style="font-size:13px; color:#777777;">
        This code will expire in <strong>10 minutes</strong>.
      </p>
    `,
  });

  const text = `
Hello ${name || 'there'}!

Your verification code for ${BRAND.name} is:

    ${otp}

This code will expire in 10 minutes.

— The ${BRAND.name} Team
  `.trim();

  return sendEmail({
    to: email,
    subject: `Verify your email — ${BRAND.shortName}`,
    text,
    html,
  });
}

module.exports = {
  sendEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendVerificationEmail,
  getTransporter,
};