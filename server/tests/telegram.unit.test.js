/**
 * Unit tests for lib/telegram.js — article announcements.
 * https.request is mocked; no real Telegram API calls are made.
 */

const https = require('https');
const { EventEmitter } = require('events');
const { sendArticleAnnouncement } = require('../lib/telegram');

const ARTICLE = {
  id: 'art-1',
  slug: 'my-article',
  title: 'Test Article',
  description: 'A description',
  content: 'Article body',
  note: 'A note',
  image: 'https://res.cloudinary.com/demo/image/upload/photo.jpg',
  videoUrl: null,
};

// Fake https.request that records calls and responds via the callback.
function mockHttps(handler) {
  const calls = [];
  jest.spyOn(https, 'request').mockImplementation((options, callback) => {
    const req = new EventEmitter();
    req.write = jest.fn();
    req.end = jest.fn(() => {
      const { statusCode = 200, body = { ok: true, result: {} } } =
        (handler && handler(options)) || {};
      const res = new EventEmitter();
      res.statusCode = statusCode;
      process.nextTick(() => {
        callback(res);
        res.emit('data', JSON.stringify(body));
        res.emit('end');
      });
    });
    req.destroy = jest.fn();
    calls.push({ options, req });
    return req;
  });
  return calls;
}

function methodCalls(calls, method) {
  return calls.filter((c) => c.options.path.endsWith(`/${method}`));
}

function lastBody(call) {
  return JSON.parse(call.req.write.mock.calls[0][0]);
}

describe('lib/telegram — sendArticleAnnouncement', () => {
  const OLD_ENV = process.env;
  let httpsSpy;

  beforeEach(() => {
    process.env = {
      ...OLD_ENV,
      TELEGRAM_BOT_TOKEN: 'test-token',
      TELEGRAM_CHAT_ID: '12345',
      NEXT_PUBLIC_SITE_URL: 'https://example.com',
    };
    httpsSpy = jest.spyOn(https, 'request');
  });

  afterEach(() => {
    httpsSpy.mockRestore();
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('sends photo, message and article link for an image article', async () => {
    const calls = mockHttps();
    const result = await sendArticleAnnouncement(ARTICLE);

    expect(result.sent).toBe(true);
    expect(result.imageSent).toBe(true);
    expect(methodCalls(calls, 'sendPhoto')).toHaveLength(1);
    expect(methodCalls(calls, 'sendMessage').length).toBeGreaterThan(0);

    const photoCall = methodCalls(calls, 'sendPhoto')[0];
    expect(photoCall.options.hostname).toBe('api.telegram.org');
    expect(photoCall.options.path).toContain('/bottest-token/sendPhoto');
    const photoBody = lastBody(photoCall);
    expect(photoBody.photo).toBe(ARTICLE.image);
    expect(photoBody.caption).toBe('Test Article');

    const msgBody = lastBody(methodCalls(calls, 'sendMessage')[0]);
    expect(msgBody.text).toContain('Test Article');
    expect(msgBody.text).toContain('https://example.com/articles/my-article');
  });

  it('sends a direct video file via sendVideo', async () => {
    const calls = mockHttps();
    const result = await sendArticleAnnouncement({
      ...ARTICLE,
      videoUrl: 'https://cdn.example.com/videos/demo.mp4',
    });

    expect(result.videoSent).toBe(true);
    const videoCalls = methodCalls(calls, 'sendVideo');
    expect(videoCalls).toHaveLength(1);
    const payload = lastBody(videoCalls[0]);
    expect(payload.video).toBe('https://cdn.example.com/videos/demo.mp4');
    expect(payload.caption).toBe('Test Article');
  });

  it('includes YouTube links as text without calling sendVideo', async () => {
    const calls = mockHttps();
    const result = await sendArticleAnnouncement({
      ...ARTICLE,
      videoUrl: 'https://www.youtube.com/watch?v=abc123',
    });

    expect(result.videoSent).toBe(false);
    expect(methodCalls(calls, 'sendVideo')).toHaveLength(0);

    const msgBody = lastBody(methodCalls(calls, 'sendMessage')[0]);
    expect(msgBody.text).toContain(
      'Video: https://www.youtube.com/watch?v=abc123'
    );
  });

  it('skips photo when the article has no image', async () => {
    const calls = mockHttps();
    const result = await sendArticleAnnouncement({
      ...ARTICLE,
      image: null,
    });

    expect(result.imageSent).toBe(false);
    expect(methodCalls(calls, 'sendPhoto')).toHaveLength(0);
    expect(result.sent).toBe(true);
  });

  it('reports a warning when the image send fails but still sends text', async () => {
    const calls = mockHttps((options) =>
      options.path.endsWith('/sendPhoto')
        ? {
            statusCode: 400,
            body: { ok: false, description: 'wrong file identifier' },
          }
        : undefined
    );

    const result = await sendArticleAnnouncement(ARTICLE);

    expect(result.sent).toBe(true);
    expect(result.imageSent).toBe(false);
    expect(result.warning).toContain('wrong file identifier');
    expect(methodCalls(calls, 'sendMessage').length).toBeGreaterThan(0);
  });

  it('rejects with a network error when the request fails', async () => {
    jest.spyOn(https, 'request').mockImplementation(() => {
      const req = new EventEmitter();
      req.write = jest.fn();
      req.end = jest.fn(() => {
        process.nextTick(() => req.emit('error', new Error('ECONNREFUSED')));
      });
      req.destroy = jest.fn();
      return req;
    });

    await expect(sendArticleAnnouncement(ARTICLE)).rejects.toThrow(
      'Could not connect to Telegram'
    );
  });

  it('throws when Telegram env vars are missing', async () => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    await expect(sendArticleAnnouncement(ARTICLE)).rejects.toThrow(
      'Telegram is not configured'
    );
  });
});
