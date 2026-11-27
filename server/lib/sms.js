const axios = require('axios');
const https = require('https');
const fs = require('fs');
const BRAND = {
  name: process.env.BRAND_NAME || 'Dream More',
};
const AFROMESSAGE_BASE_URL =
  process.env.AFROMESSAGE_BASE_URL || 'https://api.afromessage.com/api';
const TLS_ERROR_CODES = new Set([
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'CERT_HAS_EXPIRED',
]);
function normalizePhone(raw) {
  if (!raw || typeof raw !== 'string') return null;
  let digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('251')) {
  } else if (digits.startsWith('0')) {
    digits = '251' + digits.slice(1);
  } else if (digits.length === 9) {
    digits = '251' + digits;
  }
  if (!/^251\d{9}$/.test(digits)) return null;
  return digits;
}
function sanitizeSmsText(text) {
  return String(text ?? '')
    .replace(/<<[^>]*>>/g, '')
    .replace(/\{\{[^}]*\}\}/g, '')
    .replace(/[*<>{}\[\]_`~#|\\]/g, '')
    .replace(/\.{3,}|…/g, '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
function cleanApiKey(raw) {
  return String(raw || '')
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .replace(/^Bearer\s+/i, '')
    .replace(/\s+/g, '');
}
function getConfig() {
  const apiKey = cleanApiKey(process.env.AFROMESSAGE_API_KEY);
  if (!apiKey) {
    throw new Error('AFROMESSAGE_API_KEY is not set in environment');
  }
  const dots = (apiKey.match(/\./g) || []).length;
  if (dots !== 2) {
    throw new Error(
      `AFROMESSAGE_API_KEY is malformed: it has ${dots} periods but must have exactly 2. ` +
        'Check .env: one token only, then restart the server.'
    );
  }
  return {
    apiKey,
    senderId:
      (process.env.AFROMESSAGE_SENDER_ID || process.env.AFROMESSAGE_SENDER_NAME || '').trim() ||
      undefined,
    identifierId: (process.env.AFROMESSAGE_IDENTIFIER_ID || '').trim() || undefined,
  };
}
function buildAgent({ insecure }) {
  if (insecure) {
    return new https.Agent({ rejectUnauthorized: false });
  }
  const caFile = process.env.AFROMESSAGE_CA_FILE;
  if (caFile && fs.existsSync(caFile)) {
    return new https.Agent({ ca: fs.readFileSync(caFile) });
  }
  return undefined; 
}
function explainError(detail) {
  const text = String(detail || '');
  const lower = text.toLowerCase();

  if (lower.includes('balance is too low') || lower.includes('401-9')) {
    return 'AfroMessage account balance is too low. Top up the balance in the AfroMessage dashboard.';
  }
  if (lower.includes('invalid token') || lower.includes('401-11')) {
    return 'AfroMessage API key is invalid. Copy a fresh token from the AfroMessage dashboard.';
  }
  if (lower.includes('unverified')) {
    return 'Phone number is not verified in the AfroMessage dashboard (test account).';
  }
  return text;
}

const errorDetail = (e) =>
  e.response?.data ? JSON.stringify(e.response.data) : e.message;
async function sendSms({ to, message }) {
  const phone = normalizePhone(to);
  if (!phone) {
    throw new Error(`Invalid phone number: ${to}`);
  }
  const finalMessage = sanitizeSmsText(message);
  if (!finalMessage) {
    throw new Error('SMS message cannot be empty');
  }
  const { apiKey, senderId, identifierId } = getConfig();
  const body = {
    to: phone,
    message: finalMessage,
  };
  if (senderId) body.sender_id = senderId;
  if (identifierId) body.from = identifierId;

  console.log('📤 Sending AfroMessage SMS:', {
    to: phone,
    sender_id: senderId || null,
    message: finalMessage,
  });
  const SMS_TIMEOUT_MS = Number(process.env.AFROMESSAGE_TIMEOUT_MS) || 30000;
  const request = (insecure) =>
    axios.post(`${AFROMESSAGE_BASE_URL}/send`, body, {
      timeout: SMS_TIMEOUT_MS,
      httpsAgent: buildAgent({ insecure }),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });
  const forceInsecure = process.env.AFROMESSAGE_INSECURE_TLS === 'true';
  const strictTls = process.env.AFROMESSAGE_STRICT_TLS === 'true';
  let res;
  try {
    res = await request(forceInsecure);
  } catch (err) {
    const code = err?.code || err?.cause?.code;
    if (!forceInsecure && !strictTls && TLS_ERROR_CODES.has(code)) {
      console.warn(`⚠️ TLS check failed (${code}). Retrying without certificate verification.`);
      try {
        res = await request(true);
      } catch (retryErr) {
        throw new Error(explainError(errorDetail(retryErr)));
      }
    } else {
      throw new Error(explainError(errorDetail(err)));
    }
  }
  const data = res.data;
  console.log('📥 AfroMessage response:', JSON.stringify(data));
  if (String(data?.acknowledge).toLowerCase() !== 'success') {
    const errors = data?.response?.errors;
    const reason = Array.isArray(errors)
      ? errors.join(', ')
      : data?.message || JSON.stringify(data);
    throw new Error(explainError(reason));
  }
  console.log(`✅ SMS sent via AfroMessage to: ${phone}`);
  return data;
}
async function sendOrderApprovalSms(order) {
  if (!order) {
    throw new Error('sendOrderApprovalSms: order is required');
  }
  const name = sanitizeSmsText(order.customerName) || 'Customer';
  const orderNumber = sanitizeSmsText(order.orderNumber);
  const total = Number(order.total) || 0;
  const message =
    `${BRAND.name}: Hi ${name}, your order${orderNumber ? ` ${orderNumber}` : ''} is confirmed. ` +
    `Total: ETB ${total.toFixed(2)}. We will contact you for delivery. Thank you!`;

  return sendSms({ to: order.customerPhone, message });
}
module.exports = {
  sendSms,
  sendOrderApprovalSms,
  normalizePhone,
  sanitizeSmsText,
};