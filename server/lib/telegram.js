const TELEGRAM_API_BASE_URL = 'https://api.telegram.org';
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

async function telegramRequest(token, method, payload) {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    TELEGRAM_REQUEST_TIMEOUT_MS
  );

  let response;
  try {
    response = await fetch(
      `${TELEGRAM_API_BASE_URL}/bot${token}/${method}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      }
    );
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Telegram did not respond before the request timed out.');
    }
    throw new Error('Could not connect to Telegram. Check the server network.');
  } finally {
    clearTimeout(timeout);
  }

  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error('Telegram returned an unreadable response.');
  }

  if (!response.ok || result?.ok !== true) {
    const description =
      typeof result?.description === 'string'
        ? result.description
        : `HTTP ${response.status}`;
    throw new Error(`Telegram rejected the message: ${description}`);
  }

  return result;
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
    `Note:\n${article.note || 'No additional note provided.'}`,
    '',
    `Read the article: ${articleUrl}`,
  ].join('\n');

  let imageWarning;
  if (article.image) {
    try {
      await telegramRequest(token, 'sendPhoto', {
        chat_id: chatId,
        photo: article.image,
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

  for (const chunk of splitTelegramMessage(message)) {
    await telegramRequest(token, 'sendMessage', {
      chat_id: chatId,
      text: chunk,
    });
  }

  return {
    sent: true,
    imageSent: article.image ? !imageWarning : false,
    ...(imageWarning ? { warning: imageWarning } : {}),
  };
}

module.exports = { sendArticleAnnouncement };
