const https = require('https');

const TELEGRAM_REQUEST_TIMEOUT_MS = 10000;
const TELEGRAM_MAX_MESSAGE_CODE_POINTS = 3500;

function getArticleUrl(slug) {
  const configuredSiteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.FRONTEND_URL ||
    process.env.CLIENT_URL ||
    (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3000');

  if (!configuredSiteUrl) {
    throw new Error('Set NEXT_PUBLIC_SITE_URL to the public website URL.');
  }

  let siteUrl;
  try {
    siteUrl = new URL(configuredSiteUrl);
  } catch {
    throw new Error('NEXT_PUBLIC_SITE_URL must be a valid website URL.');
  }

  if (siteUrl.protocol !== 'https:' && siteUrl.protocol !== 'http:') {
    throw new Error('NEXT_PUBLIC_SITE_URL must use HTTP or HTTPS.');
  }

  return new URL(`/articles/${encodeURIComponent(slug)}`, siteUrl).toString();
}

function telegramRequest(token, method, payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const req = https.request(
      {
        hostname: 'api.telegram.org',
        path: `/bot${token}/${method}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
        // Bypass TLS verification (proxies/antivirus often break the chain)
        rejectUnauthorized: false,
        timeout: TELEGRAM_REQUEST_TIMEOUT_MS,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          let result;
          try {
            result = JSON.parse(data);
          } catch {
            return reject(new Error('Telegram returned an unreadable response.'));
          }

          if (res.statusCode < 200 || res.statusCode >= 300 || result?.ok !== true) {
            const description =
              typeof result?.description === 'string'
                ? result.description
                : `HTTP ${res.statusCode}`;
            return reject(new Error(`Telegram rejected the message: ${description}`));
          }

          resolve(result);
        });
      }
    );

    req.on('timeout', () => {
      req.destroy(new Error('Telegram did not respond before the request timed out.'));
    });
    req.on('error', (error) => {
      reject(
        new Error(
          `Could not connect to Telegram. Check the server network. (${error.message})`
        )
      );
    });

    req.write(body);
    req.end();
  });
}

function isHttpUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

// Resolve an article image value to a fetchable http(s) URL.
// Handles relative /uploads/... paths stored by older uploads.
function resolveImageUrl(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (isHttpUrl(trimmed)) return trimmed;

  if (trimmed.startsWith('/')) {
    const base = (
      process.env.PUBLIC_API_URL ||
      process.env.API_PUBLIC_URL ||
      process.env.SERVER_PUBLIC_URL ||
      ''
    ).replace(/\/+$/, '');
    if (base && isHttpUrl(base)) {
      return `${base}${trimmed}`;
    }
  }
  return null;
}

function isDirectVideoUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    return /\.(mp4|webm|mov|m4v|ogv|3gp)(\?.*)?$/i.test(url.pathname);
  } catch {
    return false;
  }
}

function splitTelegramMessage(message) {
  const codePoints = Array.from(message);
  const chunks = [];
  for (let offset = 0; offset < codePoints.length; offset += TELEGRAM_MAX_MESSAGE_CODE_POINTS) {
    chunks.push(
      codePoints.slice(offset, offset + TELEGRAM_MAX_MESSAGE_CODE_POINTS).join('')
    );
  }
  return chunks;
}

async function sendArticleAnnouncement(article) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    throw new Error(
      'Telegram is not configured. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID.'
    );
  }

  const articleUrl = getArticleUrl(article.slug);
  const message = [
    'New article on Dream More',
    '',
    `Title: ${article.title}`,
    '',
    `Description:\n${article.description}`,
    '',
    `Article content:\n${article.content}`,
    '',
    ...(article.videoUrl ? [`Video: ${article.videoUrl}`, ''] : []),
    ...(article.pdfUrl ? [`PDF: ${article.pdfUrl}`, ''] : []),
    `Note:\n${article.note || 'No additional note provided.'}`,
    '',
    `Read the article: ${articleUrl}`,
  ].join('\n');

  let imageWarning;
  const imageUrl = resolveImageUrl(article.image);
  if (article.image && typeof article.image === 'string' && article.image.trim() && !imageUrl) {
    imageWarning = `Article image is not a valid http(s) URL: ${article.image.trim()}`;
    console.error(
      `Telegram article image skipped for article ${article.id}: ${imageWarning}`
    );
  }
  if (imageUrl) {
    try {
      await telegramRequest(token, 'sendPhoto', {
        chat_id: chatId,
        photo: imageUrl,
        caption: article.title,
      });
    } catch (error) {
      imageWarning =
        error instanceof Error
          ? error.message
          : 'Telegram could not send the article image.';
      console.error(`Telegram article image failed for article ${article.id}: ${imageWarning}`);
    }
  }

  let videoWarning;
  let videoSent = false;
  if (article.videoUrl && isDirectVideoUrl(article.videoUrl)) {
    try {
      await telegramRequest(token, 'sendVideo', {
        chat_id: chatId,
        video: article.videoUrl,
        caption: article.title,
      });
      videoSent = true;
    } catch (error) {
      videoWarning =
        error instanceof Error
          ? error.message
          : 'Telegram could not send the article video.';
      console.error(`Telegram article video failed for article ${article.id}: ${videoWarning}`);
    }
  }

  let pdfWarning;
  let pdfSent = false;
  const pdfUrl = resolveImageUrl(article.pdfUrl);
  if (pdfUrl && /\.pdf(\?.*)?$/i.test(new URL(pdfUrl).pathname)) {
    try {
      await telegramRequest(token, 'sendDocument', {
        chat_id: chatId,
        document: pdfUrl,
        caption: article.title,
      });
      pdfSent = true;
    } catch (error) {
      pdfWarning =
        error instanceof Error
          ? error.message
          : 'Telegram could not send the article PDF.';
      console.error(`Telegram article PDF failed for article ${article.id}: ${pdfWarning}`);
    }
  }

  for (const chunk of splitTelegramMessage(message)) {
    await telegramRequest(token, 'sendMessage', {
      chat_id: chatId,
      text: chunk,
    });
  }

  const warnings = [imageWarning, videoWarning, pdfWarning].filter(Boolean);
  return {
    sent: true,
    imageSent: article.image ? !imageWarning : false,
    videoSent,
    pdfSent,
    ...(warnings.length ? { warning: warnings.join(' | ') } : {}),
  };
}

module.exports = { sendArticleAnnouncement };
