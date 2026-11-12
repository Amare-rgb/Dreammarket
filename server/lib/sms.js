// lib/sms.js — Africa's Talking SMS notifications
// Bypass TLS verification: some networks (antivirus/proxy) break the cert chain.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const africastalking = require('africastalking');

const BRAND = {
  name: process.env.BRAND_NAME || 'Dream More',
};

// ─────────────────────────────────────────────────────────────
// Normalize a phone number to international format (no +).
// Accepts: 0911..., +251911..., 251911..., 911...
// ─────────────────────────────────────────────────────────────
function normalizePhone(raw) {
  if (!raw || typeof raw !== 'string') return null;
  let digits = raw.replace(/\D/g, '');
  if (!digits) return null;

  if (digits.startsWith('00')) digits = digits.slice(2);

  if (digits.startsWith('251')) {
    // already international
  } else if (digits.startsWith('0')) {
    digits = '251' + digits.slice(1);
  } else if (digits.length === 9 || (digits.length === 10 && digits.startsWith('9'))) {
    digits = '251' + digits;
  }

  // Must look like an Ethiopian international number
  if (!/^251\d{9}$/.test(digits)) return null;
  return digits;
}

function getClient() {
  const apiKey = process.env.AT_API_KEY;
  if (!apiKey) {
    throw new Error('AT_API_KEY is not set in environment');
  }
  const username = process.env.AT_USERNAME || 'sandbox';
  return africastalking({ apiKey, username });
}

// ─────────────────────────────────────────────────────────────
// sendSms — low-level send
// ─────────────────────────────────────────────────────────────
async function sendSms({ to, message }) {
  const phone = normalizePhone(to);
  if (!phone) {
    throw new Error(`Invalid phone number: ${to}`);
  }

  const at = getClient();
  const options = { to: `+${phone}`, message };
  if (process.env.AT_SENDER_ID) {
    options.from = process.env.AT_SENDER_ID;
  }

  const result = await at.SMS.send(options);
  console.log(`✅ SMS sent via Africa's Talking to: ${phone}`);
  return result;
}

// ─────────────────────────────────────────────────────────────
// sendOrderApprovalSms — order confirmed notification
// ─────────────────────────────────────────────────────────────
async function sendOrderApprovalSms(order) {
  if (!order) {
    throw new Error('sendOrderApprovalSms: order is required');
  }

  const name = order.customerName || 'Customer';
  const orderNumber = order.orderNumber || '';
  const total = Number(order.total) || 0;

  const message =
    `Dear ${name}, your order ${orderNumber} at ${BRAND.name} has been APPROVED. ` +
    `Total: ETB ${total.toFixed(2)}. ` +
    `We will contact you shortly for delivery. Thank you!`;

  return sendSms({ to: order.customerPhone, message });
}

module.exports = {
  sendSms,
  sendOrderApprovalSms,
  normalizePhone,
};
