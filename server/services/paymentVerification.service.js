
const prisma = require('../lib/prisma');
const path = require('path');

const AMOUNT_TOLERANCE = 0.01;
const RECEIPT_FETCH_TIMEOUT_MS = 8000;
const TESSDATA_DIR =
  path.join(__dirname, '..', 'tessdata').replace(/\\/g, '/') + '/';
let workerPromise = null;

const TRAINEDDATA_URLS = [
  'https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz',
  'https://unpkg.com/@tesseract.js-data/eng@4.0.0_best_int/eng.traineddata.gz',
  'https://raw.githubusercontent.com/naptha/tessdata/gh-pages/4.0.0_best_int/eng.traineddata.gz',
];

async function ensureTraineddata() {
  const fs = require('fs');
  const https = require('https');
  const file = path.join(TESSDATA_DIR, 'eng.traineddata.gz');
  if (fs.existsSync(file) && fs.statSync(file).size > 100_000) return true;

  fs.mkdirSync(TESSDATA_DIR, { recursive: true });
  const tmp = file + '.tmp';
  const agent = new https.Agent({ rejectUnauthorized: false });

  const download = (url, redirects = 0) =>
    new Promise((resolve, reject) => {
      if (redirects > 5) return reject(new Error('too many redirects'));
      https
        .get(url, { agent, timeout: 60000 }, (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            res.resume();
            return resolve(download(res.headers.location, redirects + 1));
          }
          if (res.statusCode !== 200) {
            res.resume();
            return reject(new Error(`HTTP ${res.statusCode}`));
          }
          const out = fs.createWriteStream(tmp);
          res.pipe(out);
          out.on('finish', () => out.close(() => resolve(tmp)));
          out.on('error', reject);
        })
        .on('timeout', function () {
          this.destroy(new Error('download timeout'));
        })
        .on('error', reject);
    });

  for (const url of TRAINEDDATA_URLS) {
    try {
      console.log(`[ocr] downloading eng.traineddata.gz from ${url}`);
      await download(url);
      fs.renameSync(tmp, file);
      console.log(`[ocr] eng.traineddata.gz saved to ${file}`);
      return true;
    } catch (err) {
      console.warn(`[ocr] download failed (${url}): ${err.message}`);
      try { fs.unlinkSync(tmp); } catch { /* ignore */ }
    }
  }
  return false;
}

async function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const fs = require('fs');
      const { createWorker } = require('tesseract.js');
      const traineddata = path.join(TESSDATA_DIR, 'eng.traineddata.gz');

      if (!fs.existsSync(traineddata) || fs.statSync(traineddata).size < 100_000) {
        const ok = await ensureTraineddata();
        if (!ok) {
          throw new Error(
            'OCR language data unavailable — could not download eng.traineddata.gz. ' +
              'Place it manually in server/tessdata/.'
          );
        }
      }

      return createWorker('eng', 1, {
        langPath: TESSDATA_DIR,
        gzip: true,
        cacheMethod: 'none',
      });
    })();
   
    workerPromise.catch(() => {
      workerPromise = null;
    });
  }
  return workerPromise;
}

async function terminateWorker() {
  if (!workerPromise) return;
  try {
    const worker = await workerPromise;
    await worker.terminate();
  } catch {
    /* ignore */
  }
  workerPromise = null;
}

process.on('SIGTERM', terminateWorker);
process.on('SIGINT', terminateWorker);
process.on('beforeExit', terminateWorker);

const OCR_CRASH_RE = /pixReadStream|attempting to read image|tesseract/i;
process.on('uncaughtException', (err) => {
  if (OCR_CRASH_RE.test(err?.message || '')) {
    console.warn('[ocr] worker error suppressed:', err.message);
    workerPromise = null; 
    return;
  }
  console.error('Uncaught exception:', err);
  process.exit(1);
});

function isPdfInput(imageInput) {
  if (typeof imageInput === 'string') return /\.pdf$/i.test(imageInput);
  if (Buffer.isBuffer(imageInput)) {
    return imageInput.slice(0, 5).toString('latin1') === '%PDF-';
  }
  return false;
}

async function extractTextFromImage(imageInput) {
  if (isPdfInput(imageInput)) {
    throw new Error('PDF receipts are not supported by OCR — upload a screenshot image.');
  }
  const worker = await getWorker();
  const { data } = await worker.recognize(imageInput);
  return (data?.text || '').trim();
}


const CURRENCY_RE = /ETB|Br\.?|ብር|Birr/i;

function parseAmount(text) {
  if (!text) return null;

  const candidates = [];


  const currencyPatterns = [
    /(?:ETB|Br\.?|ብር|Birr)\s*([0-9][0-9,]*(?:\.\d{1,2})?)/gi,
    /([0-9][0-9,]*(?:\.\d{1,2})?)\s*(?:ETB|Br\.?|ብር|Birr)/gi,
  ];
  for (const re of currencyPatterns) {
    let m;
    while ((m = re.exec(text)) !== null) {
      const n = Number(m[1].replace(/,/g, ''));
      if (Number.isFinite(n) && n > 0) candidates.push({ value: n, weight: 2 });
    }
  }

  
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(/\b([0-9]{1,3}(?:,[0-9]{3})+(?:\.\d{1,2})?|[0-9]+(?:\.\d{1,2})?)\b/);
    if (m) {
      const n = Number(m[1].replace(/,/g, ''));
      if (Number.isFinite(n) && n > 0 && n < 10_000_000) {
        candidates.push({ value: n, weight: 1 });
      }
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.weight - a.weight || b.value - a.value);
  return candidates[0].value;
}

const REF_PATTERNS = [
  /(?:transaction\s*(?:id|ref(?:erence)?)|ref(?:erence)?\s*(?:no|number|id)?|confirmation\s*(?:no|number)|receipt\s*(?:no|number)|trans\s*id)\s*[:#\-]?\s*([A-Za-z0-9][A-Za-z0-9\-]{4,29})/gi,
  /\b(ETB-TXN-[A-Za-z0-9]+)\b/gi,
  /\b(\d{10,20})\b/g, 
];

function parseTransactionRef(text) {
  if (!text) return null;
  for (const re of REF_PATTERNS) {
    re.lastIndex = 0;
    const m = re.exec(text);
    if (m && m[1]) {
      const ref = m[1].trim();
      if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(ref)) continue;
      if (/^\d{1,3}(,\d{3})*(\.\d+)?$/.test(ref)) continue;
      return ref.slice(0, 64);
    }
  }
  return null;
}

const RECEIPT_URL_RE =
  /https?:\/\/[^\s"'<>)]+(?:telebirr|ethiotelecom|cbe|commercialbank|receipt|transactioninfo)[^\s"'<>)\]]*/gi;

function parseReceiptUrls(text) {
  if (!text) return [];
  const urls = new Set();
  let m;
  RECEIPT_URL_RE.lastIndex = 0;
  while ((m = RECEIPT_URL_RE.exec(text)) !== null) {
    urls.add(m[0].replace(/[.,;]+$/, ''));
  }
  return [...urls].slice(0, 3);
}
async function fetchReceiptInfo(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RECEIPT_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; DreamMorePaymentVerifier/1.0; +https://dreammar.et)',
        Accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
    });
    if (!res.ok) return { reachable: false, status: res.status };
    const html = (await res.text()).slice(0, 500_000);

    const amount = parseAmount(html.replace(/<[^>]+>/g, ' '));
    const ref = parseTransactionRef(html.replace(/<[^>]+>/g, ' '));
    return { reachable: true, status: res.status, amount, ref };
  } catch (err) {
    return { reachable: false, error: err.name === 'AbortError' ? 'timeout' : err.message };
  } finally {
    clearTimeout(timer);
  }
}

function compareAmount(paid, expected) {
  if (paid == null || expected == null) {
    return { status: 'NEEDS_REVIEW', paid, expected };
  }
  const diff = paid - expected;
  if (Math.abs(diff) <= AMOUNT_TOLERANCE) {
    return { status: 'AMOUNT_MATCHED', paid, expected, difference: 0 };
  }
  if (diff < 0) {
    return {
      status: 'UNDERPAID',
      paid,
      expected,
      difference: Math.abs(diff),
      shortfall: Math.abs(diff),
    };
  }
  return {
    status: 'OVERPAID',
    paid,
    expected,
    difference: diff,
    extra: diff,
  };
}

/**
 * Verify a payment screenshot for an order.
 *
 * @param {object} params
 * @param {string} params.orderRef        
 * @param {object} params.user           
 * @param {string} params.imagePath      
 * @param {string} params.screenshotUrl   
 * @returns {Promise<{status:number, body:object}>}
 */
async function verifyPayment({ orderRef, user, imagePath, screenshotUrl }) {
  
  const order = await prisma.order.findFirst({
    where: {
      OR: [{ id: orderRef }, { orderNumber: orderRef }],
    },
  });

  if (!order) {
    return { status: 404, body: { success: false, error: 'Order not found.' } };
  }

  const isOwner =
    (order.userId && order.userId === user.id) ||
    (order.customerEmail || '').toLowerCase() === (user.email || '').toLowerCase();
  if (!isOwner) {
    return { status: 403, body: { success: false, error: 'You can only verify your own orders.' } };
  }

  if (order.paymentStatus === 'VERIFIED') {
    return {
      status: 409,
      body: { success: false, error: 'This order payment is already verified.', code: 'ALREADY_VERIFIED' },
    };
  }

  const expected = Number(order.total);
  let ocrText = '';
  let ocrError = null;
  try {
    ocrText = await extractTextFromImage(imagePath);
  } catch (err) {
    ocrError = err.message;
  }

  const extractedAmount = parseAmount(ocrText);
  const transactionRef = parseTransactionRef(ocrText);
  const receiptUrls = parseReceiptUrls(ocrText);

  let receiptCheck = null;
  if (receiptUrls.length > 0) {
    receiptCheck = await fetchReceiptInfo(receiptUrls[0]);
    if (extractedAmount == null && receiptCheck?.amount != null) {
    }
  }

  const effectiveAmount = extractedAmount ?? receiptCheck?.amount ?? null;
  const effectiveRef = transactionRef ?? receiptCheck?.ref ?? null;
  if (effectiveRef) {
    const existing = await prisma.order.findFirst({
      where: {
        transactionRef: effectiveRef,
        NOT: { id: order.id },
      },
      select: { id: true, orderNumber: true },
    });
    if (existing) {
      const notes = `Duplicate receipt: ref ${effectiveRef} already used on order ${existing.orderNumber}`;
      await prisma.order.update({
        where: { id: order.id },
        data: {
          paymentScreenshotUrl: screenshotUrl || order.paymentProofUrl,
          paymentStatus: 'DUPLICATE_RECEIPT',
          verificationMethod: 'OCR',
          verificationNotes: notes,
          verifiedAt: new Date(),
        },
      });
      return {
        status: 409,
        body: {
          success: false,
          code: 'DUPLICATE_RECEIPT',
          error: 'This transaction receipt has already been used.',
          errorAm: 'ይህ የግብይት ደረሰኝ ቀድሞ ጥቅም ላይ ውሏል።',
          transactionRef: effectiveRef,
        },
      };
    }
  }
  const comparison = compareAmount(effectiveAmount, expected);
  let paymentStatus;
  let verificationMethod = 'OCR';
  const notes = [];

  if (ocrError) notes.push(`OCR failed: ${ocrError}`);
  if (effectiveAmount == null) notes.push('Amount could not be read from receipt.');
  if (!effectiveRef) notes.push('Transaction reference not detected.');
  if (receiptCheck && !receiptCheck.reachable) {
    notes.push(`Receipt URL unreachable (${receiptCheck.error || receiptCheck.status}).`);
  } else if (receiptCheck?.reachable) {
    verificationMethod = 'OCR+RECEIPT_URL';
    notes.push('Official receipt page reachable.');
  }
  if (comparison.status === 'AMOUNT_MATCHED' && effectiveRef) {
    paymentStatus = 'VERIFIED';
    notes.push('Amount and reference verified.');
  } else if (comparison.status === 'AMOUNT_MATCHED') {
    paymentStatus = 'PENDING_ADMIN_REVIEW';
    notes.push('Amount matched but no transaction reference found; needs admin review.');
  } else if (comparison.status === 'UNDERPAID' || comparison.status === 'OVERPAID') {
    paymentStatus = 'AMOUNT_MISMATCH';
    notes.push(
      `${comparison.status}: paid ${comparison.paid}, expected ${comparison.expected}.`
    );
  } else {
    paymentStatus = 'PENDING_ADMIN_REVIEW';
    notes.push('Receipt unclear; flagged for admin review.');
  }

  try {
    await prisma.order.update({
      where: { id: order.id },
      data: {
        transactionRef: effectiveRef,
        paymentScreenshotUrl: screenshotUrl || order.paymentProofUrl,
        paymentStatus,
        verificationMethod,
        verificationNotes: notes.join(' '),
        verifiedAt: new Date(),
      },
    });
  } catch (err) {
    if (err?.code === 'P2002') {
      return {
        status: 409,
        body: {
          success: false,
          code: 'DUPLICATE_RECEIPT',
          error: 'This transaction receipt has already been used.',
          errorAm: 'ይህ የግብይት ደረሰኝ ቀድሞ ጥቅም ላይ ውሏል።',
        },
      };
    }
    throw err;
  }

  const localized = {
    AMOUNT_MATCHED: 'Payment amount verified successfully.',
    UNDERPAID: `Underpaid: expected ETB ${expected.toFixed(2)}, received ETB ${comparison.paid?.toFixed(2)}. Shortfall: ETB ${comparison.shortfall?.toFixed(2)}.`,
    OVERPAID: `Overpaid: expected ETB ${expected.toFixed(2)}, received ETB ${comparison.paid?.toFixed(2)}. Extra: ETB ${comparison.extra?.toFixed(2)}.`,
    NEEDS_REVIEW: 'Payment amount could not be clearly read. Your receipt is under review.',
  };

  return {
    status: 200,
    body: {
      success: true,
      paymentStatus,
      comparison: {
        status: comparison.status,
        expected,
        paid: comparison.paid ?? null,
        difference: comparison.difference ?? null,
        shortfall: comparison.shortfall ?? null,
        extra: comparison.extra ?? null,
      },
      extractedAmount: effectiveAmount,
      transactionRef: effectiveRef,
      receiptUrls,
      receiptCheckReachable: receiptCheck?.reachable ?? null,
      message: localized[comparison.status] || 'Verification complete.',
      messageAm:
        comparison.status === 'AMOUNT_MATCHED'
          ? 'የክፍያ መጠን በተሳካ ሁኔታ ተረጋግጧል።'
          : comparison.status === 'UNDERPAID'
          ? 'ክፍያ ያነሰ ነው።'
          : comparison.status === 'OVERPAID'
          ? 'ክፍያ የበለጠ ነው።'
          : 'ደረሰኝዎ በግምገማ ላይ ነው።',
    },
  };
}
async function inspectScreenshot(imagePath) {
  const text = await extractTextFromImage(imagePath);
  return {
    text: text.slice(0, 4000),
    amount: parseAmount(text),
    transactionRef: parseTransactionRef(text),
    receiptUrls: parseReceiptUrls(text),
  };
}

module.exports = {
  verifyPayment,
  inspectScreenshot,
  parseAmount,
  parseTransactionRef,
  parseReceiptUrls,
  compareAmount,
  terminateWorker,
};
