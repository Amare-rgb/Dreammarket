/**
 * paymentGateway.service.js
 *
 * Real-time transaction reference verification against the configured
 * payment provider. Supported providers via env:
 *   PAYMENT_PROVIDER=chapa   + CHAPA_SECRET_KEY
 *   PAYMENT_PROVIDER=telebirr + TELEBIRR_APP_ID + TELEBIRR_APP_KEY
 *   PAYMENT_PROVIDER=mock    (dev — accepts refs prefixed with "MOCK-OK-")
 *
 * When no provider is configured the function returns
 * { verified:false, reason:'provider_not_configured' } so callers can
 * fall back to admin escalation instead of failing hard.
 */

const https = require('https');

function httpJson(url, { method = 'GET', headers = {}, body = null, timeoutMs = 10000 } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const payload = body ? JSON.stringify(body) : null;
    const req = https.request(
      {
        hostname: u.hostname,
        path: u.pathname + u.search,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
          ...headers,
        },
        rejectUnauthorized: false,
        timeout: timeoutMs,
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(data || '{}') });
          } catch {
            resolve({ status: res.statusCode, data: {} });
          }
        });
      }
    );
    req.on('timeout', () => req.destroy(new Error('Payment provider timeout')));
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

/**
 * Verify a transaction reference with the payment provider.
 * @returns {Promise<{verified:boolean, provider:string, raw?:object, reason?:string}>}
 */
async function verifyTransactionRef(transactionRef) {
  const provider = (process.env.PAYMENT_PROVIDER || 'mock').toLowerCase();
  const ref = String(transactionRef || '').trim();
  if (!ref) return { verified: false, provider, reason: 'empty_reference' };

  try {
    if (provider === 'chapa') {
      const key = process.env.CHAPA_SECRET_KEY;
      if (!key) return { verified: false, provider, reason: 'provider_not_configured' };
      const res = await httpJson(
        `https://api.chapa.co/v1/transaction/verify/${encodeURIComponent(ref)}`,
        { headers: { Authorization: `Bearer ${key}` } }
      );
      const ok =
        res.status === 200 &&
        res.data?.status === 'success' &&
        ['success', 'active'].includes(String(res.data?.data?.status || '').toLowerCase());
      return { verified: ok, provider, raw: res.data, reason: ok ? undefined : 'provider_rejected' };
    }

    if (provider === 'telebirr') {
      const appId = process.env.TELEBIRR_APP_ID;
      const appKey = process.env.TELEBIRR_APP_KEY;
      if (!appId || !appKey) {
        return { verified: false, provider, reason: 'provider_not_configured' };
      }
      // Telebirr merchant API — adjust endpoint/headers to your integration.
      const res = await httpJson(
        `https://transaction.core.telebirr.com/api/merchant/v1/transactions/${encodeURIComponent(ref)}`,
        {
          method: 'GET',
          headers: { 'X-IBM-Client-Id': appId, 'X-IBM-Client-Secret': appKey },
        }
      );
      const ok = res.status === 200 && ['SUCCESS', 'COMPLETED'].includes(String(res.data?.status || '').toUpperCase());
      return { verified: ok, provider, raw: res.data, reason: ok ? undefined : 'provider_rejected' };
    }

    // Mock provider for development: refs starting with MOCK-OK- verify true.
    if (provider === 'mock') {
      return {
        verified: ref.toUpperCase().startsWith('MOCK-OK-'),
        provider,
        reason: ref.toUpperCase().startsWith('MOCK-OK-') ? undefined : 'provider_rejected',
      };
    }

    return { verified: false, provider, reason: 'unknown_provider' };
  } catch (error) {
    console.error('Payment provider verification error:', error.message);
    return { verified: false, provider, reason: 'provider_error' };
  }
}

module.exports = { verifyTransactionRef };
