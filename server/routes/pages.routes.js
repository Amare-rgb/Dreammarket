const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const publicRouter = express.Router();
const adminRouter = express.Router();

const normalizeText = (value) =>
  typeof value === 'string' ? value.trim() : '';

// Default content shown until an admin customizes the page.
const PAGE_DEFAULTS = {
  training: {
    slug: 'training',
    title: 'Training',
    heroTitle: 'Learn Digital Skills That Pay',
    heroSubtitle:
      'Practical courses and hands-on training to help you grow your business, master digital tools, and earn online.',
    body: '',
    links: [],
  },
  resources: {
    slug: 'resources',
    title: 'Free Resources',
    heroTitle: 'Free Guides & Tools',
    heroSubtitle:
      'Downloadable guides, templates, and resources to help you succeed — completely free.',
    body: '',
    links: [],
  },
};

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,60}$/;

function serialize(page) {
  return {
    id: page.id,
    slug: page.slug,
    title: page.title,
    heroTitle: page.heroTitle,
    heroSubtitle: page.heroSubtitle,
    body: page.body,
    links: Array.isArray(page.links) ? page.links : [],
    updatedAt: page.updatedAt,
  };
}

// ═══════════════════════════════════════════════════════════
// PUBLIC — get a single page by slug (falls back to defaults)
// ═══════════════════════════════════════════════════════════
publicRouter.get('/:slug', async (req, res) => {
  try {
    const slug = normalizeText(req.params.slug).toLowerCase();
    if (!SLUG_RE.test(slug)) {
      return res.status(400).json({ success: false, error: 'Invalid page slug.' });
    }
    const page = await prisma.sitePage.findUnique({ where: { slug } });
    if (page) {
      return res.json({ success: true, page: serialize(page) });
    }
    const fallback = PAGE_DEFAULTS[slug];
    if (fallback) {
      return res.json({ success: true, page: fallback });
    }
    return res.status(404).json({ success: false, error: 'Page not found.' });
  } catch (error) {
    console.error('Error fetching site page:', error);
    res.status(500).json({ success: false, error: 'Failed to load page.' });
  }
});

// ═══════════════════════════════════════════════════════════
// ADMIN — list / update site pages
// ═══════════════════════════════════════════════════════════
adminRouter.use(requireAuth, requireAdmin);

adminRouter.get('/', async (req, res) => {
  try {
    const pages = await prisma.sitePage.findMany({
      orderBy: { slug: 'asc' },
    });
    const bySlug = new Map(pages.map((p) => [p.slug, p]));
    // Ensure default pages always appear in the admin list
    const result = Object.keys(PAGE_DEFAULTS).map((slug) => {
      const existing = bySlug.get(slug);
      return existing ? serialize(existing) : { ...PAGE_DEFAULTS[slug], id: null, updatedAt: null };
    });
    // Include any extra custom pages too
    for (const p of pages) {
      if (!PAGE_DEFAULTS[p.slug]) result.push(serialize(p));
    }
    res.json({ success: true, pages: result });
  } catch (error) {
    console.error('Error listing site pages:', error);
    res.status(500).json({ success: false, error: 'Failed to load pages.' });
  }
});

adminRouter.put('/:slug', async (req, res) => {
  try {
    const slug = normalizeText(req.params.slug).toLowerCase();
    if (!SLUG_RE.test(slug)) {
      return res.status(400).json({ success: false, error: 'Invalid page slug.' });
    }

    const title = normalizeText(req.body?.title);
    if (!title || title.length > 200) {
      return res.status(400).json({ success: false, error: 'Provide a valid page title.' });
    }

    const heroTitle = normalizeText(req.body?.heroTitle).slice(0, 300) || null;
    const heroSubtitle = normalizeText(req.body?.heroSubtitle).slice(0, 2000) || null;
    const body = typeof req.body?.body === 'string' ? req.body.body.slice(0, 20000) : null;

    // links: array of { title, description?, url }
    let links = null;
    if (Array.isArray(req.body?.links)) {
      links = req.body.links
        .map((l) => ({
          title: normalizeText(l?.title).slice(0, 200),
          description: normalizeText(l?.description).slice(0, 1000),
          url: normalizeText(l?.url).slice(0, 2000),
        }))
        .filter((l) => l.title && l.url)
        .slice(0, 100);
    }

    const page = await prisma.sitePage.upsert({
      where: { slug },
      create: { slug, title, heroTitle, heroSubtitle, body, links },
      update: { title, heroTitle, heroSubtitle, body, links },
    });
    res.json({ success: true, page: serialize(page) });
  } catch (error) {
    console.error('Error updating site page:', error);
    res.status(500).json({ success: false, error: 'Failed to save page.' });
  }
});

module.exports = { publicRouter, adminRouter };
