const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { sendArticleAnnouncement } = require('../lib/telegram');

const router = express.Router();

const text = (value) => (typeof value === 'string' ? value.trim() : '');
const createSlug = (value) =>
  text(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);

function articleInput(body) {
  const title = text(body?.title);
  const description = text(body?.description);
  const content = text(body?.content);
  const image = text(body?.image);
  const note = text(body?.note);
  const published = body?.published === true || body?.published === 'true';

  if (!title || !description || !content) {
    return {
      error: 'Title, description, and article content are required.',
    };
  }
  if (
    title.length > 180 ||
    description.length > 1000 ||
    content.length > 100000 ||
    note.length > 4000
  ) {
    return { error: 'Title or description is too long.' };
  }
  if (image && !/^https?:\/\/\S+$/i.test(image)) {
    return { error: 'The article image must be a valid image URL.' };
  }

  const slug = createSlug(text(body?.slug) || title);
  if (!slug) return { error: 'Enter a title that can be used as an article URL.' };

  return {
    data: {
      title,
      slug,
      description,
      content,
      image: image || null,
      note: note || null,
      published,
    },
  };
}

async function uniqueSlug(baseSlug, currentId) {
  let slug = baseSlug;
  let suffix = 2;
  while (
    await prisma.article.findFirst({
      where: { slug, ...(currentId ? { id: { not: currentId } } : {}) },
      select: { id: true },
    })
  ) {
    slug = `${baseSlug}-${suffix++}`;
  }
  return slug;
}

async function announceArticle(article) {
  try {
    return await sendArticleAnnouncement(article);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'An unexpected error prevented the Telegram announcement.';
    console.error(`Telegram announcement failed for article ${article.id}: ${message}`);
    return { sent: false, error: message };
  }
}

router.get('/admin', requireAuth, requireAdmin, async (req, res) => {
  try {
    const articles = await prisma.article.findMany({
      orderBy: { updatedAt: 'desc' },
      include: { author: { select: { id: true, name: true } } },
    });
    return res.json({ success: true, articles });
  } catch (error) {
    console.error('Failed to fetch admin articles:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch articles' });
  }
});

router.get('/admin/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const article = await prisma.article.findUnique({
      where: { id: req.params.id },
    });
    if (!article) {
      return res.status(404).json({ success: false, error: 'Article not found' });
    }
    return res.json({ success: true, article });
  } catch (error) {
    console.error('Failed to fetch admin article:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch article' });
  }
});

router.post('/admin', requireAuth, requireAdmin, async (req, res) => {
  try {
    const result = articleInput(req.body);
    if (result.error) {
      return res.status(400).json({ success: false, error: result.error });
    }

    const slug = await uniqueSlug(result.data.slug);
    const article = await prisma.article.create({
      data: {
        ...result.data,
        slug,
        authorId: req.user.id,
      },
    });
    const telegram = article.published ? await announceArticle(article) : null;
    return res.status(201).json({
      success: true,
      article,
      ...(telegram ? { telegram } : {}),
    });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({
        success: false,
        error: 'An article with that URL already exists. Change the slug and try again.',
      });
    }
    console.error('Failed to create article:', error);
    return res.status(500).json({ success: false, error: 'Failed to create article' });
  }
});

router.put('/admin/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const result = articleInput(req.body);
    if (result.error) {
      return res.status(400).json({ success: false, error: result.error });
    }

    const existing = await prisma.article.findUnique({
      where: { id: req.params.id },
      select: { id: true, published: true },
    });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Article not found' });
    }

    const slug = await uniqueSlug(result.data.slug, existing.id);
    const article = await prisma.article.update({
      where: { id: existing.id },
      data: { ...result.data, slug },
    });
    const telegram =
      article.published && !existing.published
        ? await announceArticle(article)
        : null;
    return res.json({
      success: true,
      article,
      ...(telegram ? { telegram } : {}),
    });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({
        success: false,
        error: 'An article with that URL already exists. Change the slug and try again.',
      });
    }
    console.error('Failed to update article:', error);
    return res.status(500).json({ success: false, error: 'Failed to update article' });
  }
});

router.post('/admin/:id/telegram', requireAuth, requireAdmin, async (req, res) => {
  try {
    const article = await prisma.article.findUnique({
      where: { id: req.params.id },
    });
    if (!article) {
      return res.status(404).json({ success: false, error: 'Article not found' });
    }
    if (!article.published) {
      return res.status(400).json({
        success: false,
        error: 'Publish the article before sending it to Telegram.',
      });
    }

    const telegram = await announceArticle(article);
    return res.json({ success: true, telegram });
  } catch (error) {
    console.error('Failed to send article announcement:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to send the article announcement.',
    });
  }
});

router.delete('/admin/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    await prisma.article.delete({ where: { id: req.params.id } });
    return res.json({ success: true, message: 'Article deleted' });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, error: 'Article not found' });
    }
    console.error('Failed to delete article:', error);
    return res.status(500).json({ success: false, error: 'Failed to delete article' });
  }
});

router.get('/', async (req, res) => {
  try {
    const articles = await prisma.article.findMany({
      where: { published: true },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        slug: true,
        description: true,
        image: true,
        createdAt: true,
      },
    });
    return res.json({ success: true, articles });
  } catch (error) {
    console.error('Failed to fetch published articles:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch articles' });
  }
});

router.get('/:slug', async (req, res) => {
  try {
    const article = await prisma.article.findFirst({
      where: { slug: req.params.slug, published: true },
      select: {
        id: true,
        title: true,
        slug: true,
        description: true,
        content: true,
        image: true,
        note: true,
        createdAt: true,
      },
    });
    if (!article) {
      return res.status(404).json({ success: false, error: 'Article not found' });
    }
    return res.json({ success: true, article });
  } catch (error) {
    console.error('Failed to fetch published article:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch article' });
  }
});

module.exports = router;
