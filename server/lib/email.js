// lib/email.js
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT || '587', 10),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

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
// sendEmail
// ============================================================
async function sendEmail({ to, subject, html, text }) {
  if (!to) throw new Error('sendEmail: "to" is required');

  const resendKey = process.env.RESEND_API_KEY;

  if (resendKey) {
    const from = process.env.RESEND_FROM || `${BRAND.shortName} <onboarding@resend.dev>`;
    
    // ✅ Debugging Logs
    console.log(`✉️ Attempting to send email via Resend to: ${to}`);
    console.log(`   Using API Key starting with: ${resendKey.substring(0, 8)}...`);
    console.log(`   Using FROM address: ${from}`);

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
      });

      const body = await response.text();
      
      if (!response.ok) {
        console.error('❌ Resend API Error Response:', body);
        throw new Error(`Resend API error ${response.status}: ${body}`);
      }
      
      console.log('✅ Resend email sent successfully!');
      return JSON.parse(body);
    } catch (err) {
      console.error('❌ Failed to send via Resend:', err.message);
      throw err; // Re-throw so admin panel shows the error
    }
  }

  // Fallback to Nodemailer
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    throw new Error('No email provider configured. Add RESEND_API_KEY to .env');
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
// sendOrderApprovalEmail
// ============================================================
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
  sendOrderApprovalEmail,
  sendEmail,
};