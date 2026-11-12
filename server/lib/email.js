// lib/email.js
const https = require('https');

const stripSlash = (s) => String(s || '').trim().replace(/\/+$/, '');

const BRAND = {
  name: 'Dream More Affiliate Market',
  shortName: 'Dream More',
  tagline: 'Right work at right time',
  supportEmail: process.env.SUPPORT_EMAIL || 'support@alemayehplastic.com',
  website: stripSlash(process.env.FRONTEND_URL || 'http://localhost:3000'),
};

const escapeHtml = (value) =>
  String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

// ============================================================
// sendEmail — Resend first, Gmail SMTP fallback
// ============================================================
function sendViaResend({ to, subject, html, text }) {
  return new Promise((resolve, reject) => {
    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
      return reject(new Error('RESEND_API_KEY is not set'));
    }

    const from =
      process.env.RESEND_FROM || `${BRAND.shortName} <onboarding@resend.dev>`;
    const payload = JSON.stringify({ from, to: [to], subject, html, text });

    const req = https.request(
      {
        hostname: 'api.resend.com',
        path: '/emails',
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
        // Bypass TLS verification (proxies/antivirus often break the chain)
        rejectUnauthorized: false,
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(body));
            } catch {
              resolve({ raw: body });
            }
          } else {
            reject(new Error(`Resend API error ${res.statusCode}: ${body}`));
          }
        });
      }
    );

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function sendViaSmtp({ to, subject, html, text }) {
  const nodemailer = require('nodemailer');

  const host = process.env.EMAIL_HOST;
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASSWORD;
  if (!host || !user || !pass) {
    return Promise.reject(
      new Error('Gmail SMTP is not configured (EMAIL_HOST/EMAIL_USER/EMAIL_PASSWORD)')
    );
  }

  const port = Number(process.env.EMAIL_PORT) || 587;
  const from =
    process.env.EMAIL_FROM || `${BRAND.name} <${user}>`;

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
  });

  return transporter.sendMail({
    from,
    to,
    subject,
    text,
    html,
  });
}

async function sendEmail({ to, subject, html, text }) {
  if (!to) throw new Error('sendEmail: "to" is required');

  try {
    const result = await sendViaResend({ to, subject, html, text });
    console.log(`✅ Email sent via Resend to: ${to}`);
    return result;
  } catch (resendError) {
    console.error(
      `❌ Resend failed for ${to}: ${resendError.message}. Trying Gmail SMTP fallback...`
    );
  }

  const result = await sendViaSmtp({ to, subject, html, text });
  console.log(`✅ Email sent via Gmail SMTP to: ${to}`);
  return result;
}

// ============================================================
// sendOrderApprovalEmail
// ============================================================
async function sendOrderApprovalEmail(order) {
  if (!order) {
    throw new Error('sendOrderApprovalEmail: order is required');
  }

  const safeName = escapeHtml(order.customerName || 'there');
  const safeOrderNumber = escapeHtml(order.orderNumber || 'ORD-001');
  
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
  
  const safeAddress = escapeHtml(order.shippingAddress || 'Bahir Dar, Ethiopia');
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
    `Your order ${order.orderNumber || 'ORD-001'} has been approved and confirmed.`,
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
    subject: `Order ${order.orderNumber || 'ORD-001'} confirmed`,
    text,
    html,
  });
}

module.exports = {
  sendOrderApprovalEmail,
  sendEmail,
};