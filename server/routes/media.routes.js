const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { sendEmail } = require('../lib/email');

const publicRouter = express.Router();
const adminRouter = express.Router();

const normalizeText = (value) =>
  typeof value === 'string' ? value.trim() : '';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PERIODS = ['LAST_7_DAYS', 'LAST_30_DAYS'];
const NEWSLETTER_TYPES = ['edit-smarter', 'news', 'videos', 'articles', 'webinars'];

const EDIT_SMARTER_BLUE = '#1d4ed8';
const FRONTEND_URL = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/+$/, '');

const escapeHtml = (value) =>
  String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

function newsletterEmailHtml({ subject, previewText, bodyHtml }) {
  return `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;color:#1e293b;line-height:1.6;">
      <div style="background:${EDIT_SMARTER_BLUE};padding:28px 24px;text-align:center;">
        <h1 style="margin:0;color:#ffffff;font-size:26px;letter-spacing:0.5px;">Edit Smarter</h1>
        <p style="margin:6px 0 0;color:#bfdbfe;font-size:12px;text-transform:uppercase;letter-spacing:2px;">Weekly Newsletter</p>
      </div>
      ${previewText ? `<p style="padding:16px 24px 0;margin:0;color:#64748b;font-size:14px;font-style:italic;">${escapeHtml(previewText)}</p>` : ''}
      <div style="padding:24px;">
        <h2 style="margin:0 0 12px;color:#0f172a;font-size:20px;">${escapeHtml(subject)}</h2>
        <div style="font-size:15px;color:#334155;">${bodyHtml}</div>
      </div>
      <div style="background:#f1f5f9;padding:18px 24px;text-align:center;font-size:12px;color:#64748b;">
        <p style="margin:0 0 6px;">You received this because you subscribed to Edit Smarter.</p>
        <p style="margin:0;">
          <a href="${FRONTEND_URL}/newsletter/unsubscribe" style="color:${EDIT_SMARTER_BLUE};">Unsubscribe</a>
          &nbsp;·&nbsp;
          <a href="${FRONTEND_URL}/newsletter" style="color:${EDIT_SMARTER_BLUE};">View past newsletters</a>
        </p>
      </div>
    </div>`;
}

function bodyToHtml(body) {
  return String(body || '')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p style="margin:0 0 14px;">${escapeHtml(p).replace(/\n/g, '<br/>')}</p>`)
    .join('');
}

function sendSubscriptionConfirmation(subscriber) {
  const html = newsletterEmailHtml({
    subject: 'Welcome to Edit Smarter',
    previewText: 'Your subscription is confirmed.',
    bodyHtml: `<p>Hi ${escapeHtml(subscriber.firstName)},</p>
      <p>Thanks for subscribing to <strong>Edit Smarter</strong>! You'll receive our weekly newsletter with the latest media industry news, video releases, and articles.</p>
      <p><a href="${FRONTEND_URL}/newsletter" style="color:${EDIT_SMARTER_BLUE};font-weight:bold;">Browse past newsletters →</a></p>`,
  });
  sendEmail({
    to: subscriber.email,
    subject: 'Welcome to Edit Smarter Newsletter',
    html,
    text: `Hi ${subscriber.firstName}, thanks for subscribing to Edit Smarter!`,
  }).catch((err) => console.error('Subscription confirmation email failed:', err.message));
}

async function sendIssueToSubscribers(issue) {
  const subscribers = await prisma.newsletterSubscriber.findMany({
    where: { status: 'ACTIVE' },
  });
  const recipients = subscribers.filter((s) => {
    const types = (s.types || '').split(',');
    return types.includes('edit-smarter') || types.includes('news');
  });

  const bodyHtml = bodyToHtml(issue.body);
  const html = newsletterEmailHtml({
    subject: issue.subject,
    previewText: issue.previewText,
    bodyHtml,
  });
  const text = `${issue.subject}\n\n${issue.body}\n\n— Edit Smarter`;

  let sent = 0;
  let failed = 0;
  for (const sub of recipients) {
    try {
      await sendEmail({ to: sub.email, subject: issue.subject, html, text });
      sent += 1;
    } catch (err) {
      failed += 1;
      console.error(`Newsletter send failed for ${sub.email}:`, err.message);
    }
  }
  return { sent, failed, total: recipients.length };
}

publicRouter.get('/news', async (req, res) => {
  try {
    const items = await prisma.newsItem.findMany({
      orderBy: { date: 'desc' },
    });
    res.json({ success: true, items });
  } catch (error) {
    console.error('Error fetching news:', error);
    res.status(500).json({ success: false, error: 'Failed to load news.' });
  }
});

publicRouter.get('/videos', async (req, res) => {
  try {
    const items = await prisma.videoRelease.findMany({
      orderBy: { publishedAt: 'desc' },
      take: 50,
    });
    res.json({ success: true, items });
  } catch (error) {
    console.error('Error fetching videos:', error);
    res.status(500).json({ success: false, error: 'Failed to load videos.' });
  }
});

publicRouter.get('/popular-articles', async (req, res) => {
  try {
    const period = PERIODS.includes(req.query?.period)
      ? req.query.period
      : 'LAST_7_DAYS';
    const items = await prisma.popularArticle.findMany({
      where: { period },
      orderBy: [{ rank: 'asc' }, { createdAt: 'desc' }],
      take: 20,
    });
    res.json({ success: true, items });
  } catch (error) {
    console.error('Error fetching popular articles:', error);
    res.status(500).json({ success: false, error: 'Failed to load articles.' });
  }
});

publicRouter.post('/newsletter/subscribe', async (req, res) => {
  try {
    const firstName = normalizeText(req.body?.firstName);
    const lastName = normalizeText(req.body?.lastName);
    const email = normalizeText(req.body?.email).toLowerCase();
    const rawTypes = Array.isArray(req.body?.types) ? req.body.types : [];
    const types = rawTypes
      .map((t) => normalizeText(t))
      .filter((t) => NEWSLETTER_TYPES.includes(t));

    const honeypot = normalizeText(req.body?.website || req.body?.company);
    if (honeypot) {
      return res.status(201).json({ success: true, subscriber: { email } });
    }

    if (!firstName || firstName.length > 100) {
      return res.status(400).json({ success: false, error: 'First name is required.' });
    }
    if (!lastName || lastName.length > 100) {
      return res.status(400).json({ success: false, error: 'Last name is required.' });
    }
    if (!EMAIL_RE.test(email) || email.length > 200) {
      return res.status(400).json({ success: false, error: 'Enter a valid email address.' });
    }
    if (types.length === 0) {
      return res.status(400).json({ success: false, error: 'Select at least one newsletter type.' });
    }

    const existing = await prisma.newsletterSubscriber.findUnique({ where: { email } });
    if (existing) {
      if (existing.status === 'ACTIVE') {
        return res.status(409).json({
          success: false,
          error: 'This email is already subscribed.',
        });
      }
      const updated = await prisma.newsletterSubscriber.update({
        where: { email },
        data: { firstName, lastName, types: types.join(','), status: 'ACTIVE' },
      });
      sendSubscriptionConfirmation(updated);
      return res.status(200).json({ success: true, subscriber: updated });
    }

    const subscriber = await prisma.newsletterSubscriber.create({
      data: { firstName, lastName, email, types: types.join(',') },
    });
    sendSubscriptionConfirmation(subscriber);
    res.status(201).json({ success: true, subscriber });
  } catch (error) {
    console.error('Error subscribing to newsletter:', error);
    res.status(500).json({ success: false, error: 'Subscription failed. Please try again.' });
  }
});

publicRouter.get('/newsletter/issues', async (req, res) => {
  try {
    const items = await prisma.newsletterIssue.findMany({
      where: { status: 'SENT' },
      orderBy: { publishedAt: 'desc' },
      select: {
        id: true,
        subject: true,
        previewText: true,
        publishedAt: true,
        createdAt: true,
      },
    });
    res.json({ success: true, items });
  } catch (error) {
    console.error('Error listing newsletter issues:', error);
    res.status(500).json({ success: false, error: 'Failed to load newsletters.' });
  }
});
publicRouter.get('/newsletter/issues/:id', async (req, res) => {
  try {
    const item = await prisma.newsletterIssue.findFirst({
      where: { id: req.params.id, status: 'SENT' },
    });
    if (!item) {
      return res.status(404).json({ success: false, error: 'Newsletter not found.' });
    }
    res.json({ success: true, item });
  } catch (error) {
    console.error('Error fetching newsletter issue:', error);
    res.status(500).json({ success: false, error: 'Failed to load newsletter.' });
  }
});

publicRouter.get('/newsletter/unsubscribe', async (req, res) => {
  try {
    const token = normalizeText(req.query?.token);
    if (!token) {
      return res.status(400).json({ success: false, error: 'Missing unsubscribe token.' });
    }
    const subscriber = await prisma.newsletterSubscriber.findUnique({
      where: { unsubscribeToken: token },
    });
    if (!subscriber) {
      return res.status(404).json({ success: false, error: 'Invalid unsubscribe link.' });
    }
    if (subscriber.status !== 'UNSUBSCRIBED') {
      await prisma.newsletterSubscriber.update({
        where: { id: subscriber.id },
        data: { status: 'UNSUBSCRIBED' },
      });
    }
    res.json({ success: true, message: 'You have been unsubscribed.' });
  } catch (error) {
    console.error('Error unsubscribing:', error);
    res.status(500).json({ success: false, error: 'Unsubscribe failed.' });
  }
});

adminRouter.use(requireAuth, requireAdmin);

adminRouter.get('/news', async (req, res) => {
  try {
    const items = await prisma.newsItem.findMany({ orderBy: { date: 'desc' } });
    res.json({ success: true, items });
  } catch (error) {
    console.error('Error listing news:', error);
    res.status(500).json({ success: false, error: 'Failed to load news.' });
  }
});

adminRouter.post('/news', async (req, res) => {
  try {
    const date = req.body?.date ? new Date(req.body.date) : new Date();
    const company = normalizeText(req.body?.company);
    const headline = normalizeText(req.body?.headline);
    const summary = normalizeText(req.body?.summary) || null;
    const url = normalizeText(req.body?.url) || null;
    if (isNaN(date.getTime()) || !company || !headline) {
      return res.status(400).json({ success: false, error: 'Provide a valid date, company, and headline.' });
    }
    const item = await prisma.newsItem.create({
      data: { date, company, headline, summary, url },
    });
    res.status(201).json({ success: true, item });
  } catch (error) {
    console.error('Error creating news:', error);
    res.status(500).json({ success: false, error: 'Failed to create news item.' });
  }
});

adminRouter.put('/news/:id', async (req, res) => {
  try {
    const existing = await prisma.newsItem.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ success: false, error: 'News item not found.' });
    const data = {};
    if (req.body?.date !== undefined) {
      const d = new Date(req.body.date);
      if (isNaN(d.getTime())) return res.status(400).json({ success: false, error: 'Invalid date.' });
      data.date = d;
    }
    if (req.body?.company !== undefined) {
      const c = normalizeText(req.body.company);
      if (!c) return res.status(400).json({ success: false, error: 'Company is required.' });
      data.company = c;
    }
    if (req.body?.headline !== undefined) {
      const h = normalizeText(req.body.headline);
      if (!h) return res.status(400).json({ success: false, error: 'Headline is required.' });
      data.headline = h;
    }
    if (req.body?.summary !== undefined) data.summary = normalizeText(req.body.summary) || null;
    if (req.body?.url !== undefined) data.url = normalizeText(req.body.url) || null;
    const item = await prisma.newsItem.update({ where: { id: req.params.id }, data });
    res.json({ success: true, item });
  } catch (error) {
    console.error('Error updating news:', error);
    res.status(500).json({ success: false, error: 'Failed to update news item.' });
  }
});

adminRouter.delete('/news/:id', async (req, res) => {
  try {
    await prisma.newsItem.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting news:', error);
    res.status(500).json({ success: false, error: 'Failed to delete news item.' });
  }
});

adminRouter.get('/videos', async (req, res) => {
  try {
    const items = await prisma.videoRelease.findMany({ orderBy: { publishedAt: 'desc' } });
    res.json({ success: true, items });
  } catch (error) {
    console.error('Error listing videos:', error);
    res.status(500).json({ success: false, error: 'Failed to load videos.' });
  }
});

adminRouter.post('/videos', async (req, res) => {
  try {
    const series = normalizeText(req.body?.series);
    const title = normalizeText(req.body?.title);
    const url = normalizeText(req.body?.url);
    const summary = normalizeText(req.body?.summary) || null;
    const episodeNumber = Number.isInteger(Number(req.body?.episodeNumber))
      ? Number(req.body.episodeNumber)
      : null;
    const publishedAt = req.body?.publishedAt ? new Date(req.body.publishedAt) : new Date();
    if (!series || !title || !url || isNaN(publishedAt.getTime())) {
      return res.status(400).json({ success: false, error: 'Provide series, title, URL, and a valid publish date.' });
    }
    const item = await prisma.videoRelease.create({
      data: { series, title, url, summary, episodeNumber, publishedAt },
    });
    res.status(201).json({ success: true, item });
  } catch (error) {
    console.error('Error creating video:', error);
    res.status(500).json({ success: false, error: 'Failed to create video release.' });
  }
});

adminRouter.put('/videos/:id', async (req, res) => {
  try {
    const existing = await prisma.videoRelease.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ success: false, error: 'Video not found.' });
    const data = {};
    if (req.body?.series !== undefined) {
      const s = normalizeText(req.body.series);
      if (!s) return res.status(400).json({ success: false, error: 'Series is required.' });
      data.series = s;
    }
    if (req.body?.title !== undefined) {
      const t = normalizeText(req.body.title);
      if (!t) return res.status(400).json({ success: false, error: 'Title is required.' });
      data.title = t;
    }
    if (req.body?.url !== undefined) {
      const u = normalizeText(req.body.url);
      if (!u) return res.status(400).json({ success: false, error: 'URL is required.' });
      data.url = u;
    }
    if (req.body?.summary !== undefined) data.summary = normalizeText(req.body.summary) || null;
    if (req.body?.episodeNumber !== undefined) {
      data.episodeNumber = Number.isInteger(Number(req.body.episodeNumber))
        ? Number(req.body.episodeNumber)
        : null;
    }
    if (req.body?.publishedAt !== undefined) {
      const d = new Date(req.body.publishedAt);
      if (isNaN(d.getTime())) return res.status(400).json({ success: false, error: 'Invalid publish date.' });
      data.publishedAt = d;
    }
    const item = await prisma.videoRelease.update({ where: { id: req.params.id }, data });
    res.json({ success: true, item });
  } catch (error) {
    console.error('Error updating video:', error);
    res.status(500).json({ success: false, error: 'Failed to update video release.' });
  }
});

adminRouter.delete('/videos/:id', async (req, res) => {
  try {
    await prisma.videoRelease.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting video:', error);
    res.status(500).json({ success: false, error: 'Failed to delete video release.' });
  }
});

adminRouter.get('/popular-articles', async (req, res) => {
  try {
    const items = await prisma.popularArticle.findMany({
      orderBy: [{ period: 'asc' }, { rank: 'asc' }],
    });
    res.json({ success: true, items });
  } catch (error) {
    console.error('Error listing popular articles:', error);
    res.status(500).json({ success: false, error: 'Failed to load popular articles.' });
  }
});

adminRouter.post('/popular-articles', async (req, res) => {
  try {
    const title = normalizeText(req.body?.title);
    const url = normalizeText(req.body?.url);
    const period = PERIODS.includes(req.body?.period) ? req.body.period : 'LAST_7_DAYS';
    const rank = Number.isInteger(Number(req.body?.rank)) ? Number(req.body.rank) : 0;
    const publishedAt = req.body?.publishedAt ? new Date(req.body.publishedAt) : null;
    if (!title || !url) {
      return res.status(400).json({ success: false, error: 'Provide a title and URL.' });
    }
    const item = await prisma.popularArticle.create({
      data: { title, url, period, rank, publishedAt },
    });
    res.status(201).json({ success: true, item });
  } catch (error) {
    console.error('Error creating popular article:', error);
    res.status(500).json({ success: false, error: 'Failed to create article.' });
  }
});

adminRouter.put('/popular-articles/:id', async (req, res) => {
  try {
    const existing = await prisma.popularArticle.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ success: false, error: 'Article not found.' });
    const data = {};
    if (req.body?.title !== undefined) {
      const t = normalizeText(req.body.title);
      if (!t) return res.status(400).json({ success: false, error: 'Title is required.' });
      data.title = t;
    }
    if (req.body?.url !== undefined) {
      const u = normalizeText(req.body.url);
      if (!u) return res.status(400).json({ success: false, error: 'URL is required.' });
      data.url = u;
    }
    if (req.body?.period !== undefined) {
      if (!PERIODS.includes(req.body.period)) {
        return res.status(400).json({ success: false, error: 'Invalid period.' });
      }
      data.period = req.body.period;
    }
    if (req.body?.rank !== undefined) {
      data.rank = Number.isInteger(Number(req.body.rank)) ? Number(req.body.rank) : 0;
    }
    if (req.body?.publishedAt !== undefined) {
      data.publishedAt = req.body.publishedAt ? new Date(req.body.publishedAt) : null;
    }
    const item = await prisma.popularArticle.update({ where: { id: req.params.id }, data });
    res.json({ success: true, item });
  } catch (error) {
    console.error('Error updating popular article:', error);
    res.status(500).json({ success: false, error: 'Failed to update article.' });
  }
});

adminRouter.delete('/popular-articles/:id', async (req, res) => {
  try {
    await prisma.popularArticle.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting popular article:', error);
    res.status(500).json({ success: false, error: 'Failed to delete article.' });
  }
});

adminRouter.get('/newsletter', async (req, res) => {
  try {
    const status = req.query?.status;
    const type = normalizeText(req.query?.type);
    const where = {};
    if (status === 'ACTIVE' || status === 'UNSUBSCRIBED') where.status = status;
    let items = await prisma.newsletterSubscriber.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    if (type) {
      items = items.filter((s) => (s.types || '').split(',').includes(type));
    }
    res.json({ success: true, items });
  } catch (error) {
    console.error('Error listing subscribers:', error);
    res.status(500).json({ success: false, error: 'Failed to load subscribers.' });
  }
});

adminRouter.put('/newsletter/:id/status', async (req, res) => {
  try {
    const status = normalizeText(req.body?.status);
    if (!['ACTIVE', 'UNSUBSCRIBED'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status.' });
    }
    const item = await prisma.newsletterSubscriber.update({
      where: { id: req.params.id },
      data: { status },
    });
    res.json({ success: true, item });
  } catch (error) {
    console.error('Error updating subscriber:', error);
    res.status(500).json({ success: false, error: 'Failed to update subscriber.' });
  }
});

adminRouter.delete('/newsletter/:id', async (req, res) => {
  try {
    await prisma.newsletterSubscriber.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting subscriber:', error);
    res.status(500).json({ success: false, error: 'Failed to delete subscriber.' });
  }
});

adminRouter.get('/newsletter/issues', async (req, res) => {
  try {
    const items = await prisma.newsletterIssue.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, items });
  } catch (error) {
    console.error('Error listing newsletter issues:', error);
    res.status(500).json({ success: false, error: 'Failed to load issues.' });
  }
});

adminRouter.post('/newsletter/issues', async (req, res) => {
  try {
    const subject = normalizeText(req.body?.subject);
    const body = normalizeText(req.body?.body);
    const previewText = normalizeText(req.body?.previewText) || null;
    const publishedAt = req.body?.publishedAt ? new Date(req.body.publishedAt) : new Date();
    if (!subject || subject.length > 300) {
      return res.status(400).json({ success: false, error: 'Subject is required (max 300 chars).' });
    }
    if (!body) {
      return res.status(400).json({ success: false, error: 'Body content is required.' });
    }
    if (isNaN(publishedAt.getTime())) {
      return res.status(400).json({ success: false, error: 'Invalid publish date.' });
    }
    const item = await prisma.newsletterIssue.create({
      data: { subject, previewText, body, publishedAt },
    });
    res.status(201).json({ success: true, item });
  } catch (error) {
    console.error('Error creating newsletter issue:', error);
    res.status(500).json({ success: false, error: 'Failed to create issue.' });
  }
});

adminRouter.put('/newsletter/issues/:id', async (req, res) => {
  try {
    const existing = await prisma.newsletterIssue.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ success: false, error: 'Issue not found.' });
    const data = {};
    if (req.body?.subject !== undefined) {
      const s = normalizeText(req.body.subject);
      if (!s || s.length > 300) {
        return res.status(400).json({ success: false, error: 'Subject is required (max 300 chars).' });
      }
      data.subject = s;
    }
    if (req.body?.body !== undefined) {
      const b = normalizeText(req.body.body);
      if (!b) return res.status(400).json({ success: false, error: 'Body content is required.' });
      data.body = b;
    }
    if (req.body?.previewText !== undefined) {
      data.previewText = normalizeText(req.body.previewText) || null;
    }
    if (req.body?.publishedAt !== undefined) {
      const d = new Date(req.body.publishedAt);
      if (isNaN(d.getTime())) return res.status(400).json({ success: false, error: 'Invalid publish date.' });
      data.publishedAt = d;
    }
    const item = await prisma.newsletterIssue.update({ where: { id: req.params.id }, data });
    res.json({ success: true, item });
  } catch (error) {
    console.error('Error updating newsletter issue:', error);
    res.status(500).json({ success: false, error: 'Failed to update issue.' });
  }
});

adminRouter.delete('/newsletter/issues/:id', async (req, res) => {
  try {
    await prisma.newsletterIssue.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting newsletter issue:', error);
    res.status(500).json({ success: false, error: 'Failed to delete issue.' });
  }
});
adminRouter.post('/newsletter/issues/:id/publish', async (req, res) => {
  try {
    const issue = await prisma.newsletterIssue.findUnique({ where: { id: req.params.id } });
    if (!issue) return res.status(404).json({ success: false, error: 'Issue not found.' });
    if (issue.status === 'SENT') {
      return res.status(400).json({ success: false, error: 'This issue was already published.' });
    }

    const publishedAt = req.body?.publishedAt ? new Date(req.body.publishedAt) : new Date();
    if (isNaN(publishedAt.getTime())) {
      return res.status(400).json({ success: false, error: 'Invalid publish date.' });
    }

    const updated = await prisma.newsletterIssue.update({
      where: { id: issue.id },
      data: { status: 'SENT', publishedAt },
    });
    const result = await sendIssueToSubscribers(updated);
    const final = await prisma.newsletterIssue.update({
      where: { id: issue.id },
      data: { sentCount: result.sent },
    });

    res.json({
      success: true,
      item: final,
      delivery: { sent: result.sent, failed: result.failed, total: result.total },
    });
  } catch (error) {
    console.error('Error publishing newsletter issue:', error);
    res.status(500).json({ success: false, error: 'Failed to publish issue.' });
  }
});
module.exports = { publicRouter, adminRouter };
