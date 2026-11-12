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

function isValidHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Categories helpers                                                  */
/* ------------------------------------------------------------------ */

const DEFAULT_CATEGORIES = [
  { name: 'General', slug: 'general' },
  { name: 'News', slug: 'news' },
  { name: 'Announcements', slug: 'announcements' },
  { name: 'Guides', slug: 'guides' },
  { name: 'Tips', slug: 'tips' },
  { name: 'Events', slug: 'events' },
];

async function ensureDefaultCategories() {
  if ((await prisma.articleCategory.count()) === 0) {
    await prisma.articleCategory.createMany({
      data: DEFAULT_CATEGORIES,
      skipDuplicates: true,
    });
  }
}

async function categoryExists(slug) {
  await ensureDefaultCategories();
  const found = await prisma.articleCategory.findUnique({
    where: { slug },
    select: { id: true },
  });
  return Boolean(found);
}

async function uniqueCategorySlug(name) {
  const base = createSlug(name) || `cat-${Date.now().toString(36)}`;
  let slug = base;
  let suffix = 2;
  while (
    await prisma.articleCategory.findUnique({
      where: { slug },
      select: { id: true },
    })
  ) {
    slug = `${base}-${suffix++}`;
  }
  return slug;
}

/* ------------------------------------------------------------------ */
/* Article helpers                                                     */
/* ------------------------------------------------------------------ */

function articleInput(body) {
  const title = text(body?.title);
  const description = text(body?.description);
  const content = text(body?.content);
  const category = text(body?.category).toLowerCase() || 'general';
  const image = text(body?.image);
  const videoUrl = text(body?.videoUrl);
  const pdfUrl = text(body?.pdfUrl);
  const note = text(body?.note);
  const published = body?.published === true || body?.published === 'true';

  if (!title || !description || !content) {
    return { error: 'Title, description, and article content are required.' };
  }
  if (
    title.length > 180 ||
    description.length > 1000 ||
    content.length > 100000 ||
    note.length > 4000
  ) {
    return { error: 'Title or description is too long.' };
  }
  if (category.length > 100) {
    return { error: 'The category is not valid.' };
  }
  if (image && !/^https?:\/\/\S+$/i.test(image)) {
    return { error: 'The article image must be a valid image URL.' };
  }
  if (videoUrl && (videoUrl.length > 500 || !isValidHttpUrl(videoUrl))) {
    return {
      error: 'The video URL must be a valid link starting with http:// or https://.',
    };
  }
  if (pdfUrl && (pdfUrl.length > 500 || !isValidHttpUrl(pdfUrl))) {
    return {
      error: 'The PDF URL must be a valid link starting with http:// or https://.',
    };
  }

  const slug = createSlug(text(body?.slug) || title);
  if (!slug) return { error: 'Enter a title that can be used as an article URL.' };

  return {
    data: {
      title,
      slug,
      description,
      content,
      category,
      image: image || null,
      videoUrl: videoUrl || null,
      pdfUrl: pdfUrl || null,
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

/* ------------------------------------------------------------------ */
/* Admin: categories                                                   */
/* ------------------------------------------------------------------ */

router.get('/admin/categories', requireAuth, requireAdmin, async (req, res) => {
  try {
    await ensureDefaultCategories();

    const [categories, grouped] = await Promise.all([
      prisma.articleCategory.findMany({ orderBy: { createdAt: 'asc' } }),
      prisma.article.groupBy({ by: ['category'], _count: { _all: true } }),
    ]);
    const counts = new Map(grouped.map((g) => [g.category, g._count._all]));

    return res.json({
      success: true,
      categories: categories.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        count: counts.get(c.slug) || 0,
      })),
    });
  } catch (error) {
    console.error('Failed to fetch article categories:', error);
    return res.status(500).json({ success: false, error: 'Could not load categories.' });
  }
});

router.post('/admin/categories', requireAuth, requireAdmin, async (req, res) => {
  try {
    const name = text(req.body?.name).replace(/\s+/g, ' ');
    if (name.length < 2 || name.length > 40) {
      return res.status(400).json({
        success: false,
        error: 'Category name must be 2 to 40 characters.',
      });
    }

    await ensureDefaultCategories();

    const duplicate = await prisma.articleCategory.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
      select: { id: true },
    });
    if (duplicate) {
      return res
        .status(409)
        .json({ success: false, error: 'This category already exists.' });
    }

    const slug = await uniqueCategorySlug(name);
    const category = await prisma.articleCategory.create({
      data: { name, slug },
    });

    return res.status(201).json({
      success: true,
      category: { id: category.id, name: category.name, slug: category.slug, count: 0 },
    });
  } catch (error) {
    if (error.code === 'P2002') {
      return res
        .status(409)
        .json({ success: false, error: 'This category already exists.' });
    }
    console.error('Failed to create article category:', error);
    return res.status(500).json({ success: false, error: 'Could not create the category.' });
  }
});

router.delete('/admin/categories/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const category = await prisma.articleCategory.findUnique({
      where: { id: req.params.id },
    });
    if (!category) {
      return res.status(404).json({ success: false, error: 'Category not found.' });
    }

    const inUse = await prisma.article.count({ where: { category: category.slug } });
    if (inUse > 0) {
      return res.status(400).json({
        success: false,
        error: `This category is used by ${inUse} article(s). Move or delete them first.`,
      });
    }

    await prisma.articleCategory.delete({ where: { id: category.id } });
    return res.json({ success: true });
  } catch (error) {
    console.error('Failed to delete article category:', error);
    return res.status(500).json({ success: false, error: 'Could not delete the category.' });
  }
});

/* ------------------------------------------------------------------ */
/* Admin: comments                                                     */
/* ✅ MOVED ABOVE /admin/:id TO PREVENT ROUTING CONFLICT               */
/* ------------------------------------------------------------------ */

router.get('/admin/comments', requireAuth, requireAdmin, async (req, res) => {
  try {
    const comments = await prisma.articleComment.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        article: {
          select: { title: true, slug: true }
        }
      }
    });
    return res.json({ success: true, comments });
  } catch (error) {
    console.error('Failed to fetch admin comments:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch comments' });
  }
});

router.delete('/admin/comments/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    await prisma.articleComment.delete({
      where: { id: req.params.id }
    });
    return res.json({ success: true, message: 'Comment deleted' });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, error: 'Comment not found' });
    }
    console.error('Failed to delete comment:', error);
    return res.status(500).json({ success: false, error: 'Failed to delete comment' });
  }
});

/* ------------------------------------------------------------------ */
/* Admin: articles                                                     */
/* ------------------------------------------------------------------ */

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

// ✅ Now that /admin/comments is above, this will only catch actual IDs
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
    if (!(await categoryExists(result.data.category))) {
      return res.status(400).json({ success: false, error: 'Unknown category.' });
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
    if (!(await categoryExists(result.data.category))) {
      return res.status(400).json({ success: false, error: 'Unknown category.' });
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

/* ------------------------------------------------------------------ */
/* Public                                                              */
/* "/categories" MUST stay above "/:slug".                             */
/* ------------------------------------------------------------------ */

router.get('/categories', async (req, res) => {
  try {
    await ensureDefaultCategories();

    const [categories, grouped] = await Promise.all([
      prisma.articleCategory.findMany({ orderBy: { createdAt: 'asc' } }),
      prisma.article.groupBy({
        by: ['category'],
        where: { published: true },
        _count: { _all: true },
      }),
    ]);
    const counts = new Map(grouped.map((g) => [g.category, g._count._all]));

    return res.json({
      success: true,
      categories: categories
        .map((c) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          count: counts.get(c.slug) || 0,
        }))
        .filter((c) => c.count > 0),
    });
  } catch (error) {
    console.error('Failed to fetch public article categories:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch categories' });
  }
});

router.get('/', async (req, res) => {
  try {
    const category = text(req.query?.category).toLowerCase();
    const articles = await prisma.article.findMany({
      where: { published: true, ...(category ? { category } : {}) },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        slug: true,
        description: true,
        category: true,
        image: true,
        videoUrl: true,
        createdAt: true,
      },
    });
    return res.json({ success: true, articles });
  } catch (error) {
    console.error('Failed to fetch published articles:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch articles' });
  }
});

/* ------------------------------------------------------------------ */
/* Comments (Public)                                                   */
/* ------------------------------------------------------------------ */

router.get('/:slug/comments', async (req, res) => {
  try {
    const article = await prisma.article.findFirst({
      where: { slug: req.params.slug, published: true },
      select: { id: true },
    });
    if (!article) {
      return res.status(404).json({ success: false, error: 'Article not found' });
    }

    const comments = await prisma.articleComment.findMany({
      where: { articleId: article.id },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ success: true, comments });
  } catch (error) {
    console.error('Failed to fetch comments:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch comments' });
  }
});

router.post('/:slug/comments', async (req, res) => {
  try {
    const article = await prisma.article.findFirst({
      where: { slug: req.params.slug, published: true },
      select: { id: true },
    });
    if (!article) {
      return res.status(404).json({ success: false, error: 'Article not found' });
    }

    const name = text(req.body?.name);
    const message = text(req.body?.message);

    if (!name || !message) {
      return res.status(400).json({ success: false, error: 'Name and message are required.' });
    }
    if (name.length > 80 || message.length > 1000) {
      return res.status(400).json({ success: false, error: 'Name or message is too long.' });
    }

    const comment = await prisma.articleComment.create({
      data: {
        articleId: article.id,
        name,
        message,
      },
    });

    return res.status(201).json({ success: true, comment });
  } catch (error) {
    console.error('Failed to create comment:', error);
    return res.status(500).json({ success: false, error: 'Failed to create comment' });
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
        category: true,
        image: true,
        videoUrl: true,
        pdfUrl: true,
        note: true,
        views: true,
        createdAt: true,
      },
    });
    if (!article) {
      return res.status(404).json({ success: false, error: 'Article not found' });
    }

    prisma.article
      .update({ where: { id: article.id }, data: { views: { increment: 1 } } })
      .catch((error) => console.error('Failed to count article view:', error));

    return res.json({ success: true, article });
  } catch (error) {
    console.error('Failed to fetch published article:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch article' });
  }
});

module.exports = router;