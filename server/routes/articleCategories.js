const express = require("express");
const prisma = require("../lib/prisma"); // adjust to where your Prisma client is exported

const router = express.Router();

const DEFAULTS = [
  { name: "General", slug: "general" },
  { name: "News", slug: "news" },
  { name: "Announcements", slug: "announcements" },
  { name: "Guides", slug: "guides" },
  { name: "Tips", slug: "tips" },
  { name: "Events", slug: "events" },
];

const slugify = (value) => {
  const slug = String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  // Amharic or other non-Latin names produce an empty slug, so use a fallback.
  return slug || `cat-${Date.now().toString(36)}`;
};

// GET /api/articles/admin/categories
router.get("/", async (_req, res) => {
  try {
    if ((await prisma.articleCategory.count()) === 0) {
      await prisma.articleCategory.createMany({
        data: DEFAULTS,
        skipDuplicates: true,
      });
    }

    const [categories, grouped] = await Promise.all([
      prisma.articleCategory.findMany({ orderBy: { createdAt: "asc" } }),
      prisma.article.groupBy({ by: ["category"], _count: { _all: true } }),
    ]);

    const counts = new Map(grouped.map((g) => [g.category, g._count._all]));

    res.json({
      categories: categories.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        count: counts.get(c.slug) || 0,
      })),
    });
  } catch (error) {
    console.error("List article categories failed:", error);
    res.status(500).json({ error: "Could not load categories." });
  }
});

// POST /api/articles/admin/categories
router.post("/", async (req, res) => {
  try {
    const name = String((req.body && req.body.name) || "")
      .trim()
      .replace(/\s+/g, " ");
    if (name.length < 2 || name.length > 40) {
      return res
        .status(400)
        .json({ error: "Category name must be 2 to 40 characters." });
    }

    const slug = slugify(name);
    const existing = await prisma.articleCategory.findFirst({
      where: {
        OR: [{ slug }, { name: { equals: name, mode: "insensitive" } }],
      },
    });
    if (existing) {
      return res.status(409).json({ error: "This category already exists." });
    }

    const category = await prisma.articleCategory.create({
      data: { name, slug },
    });

    res.status(201).json({
      category: { id: category.id, name: category.name, slug: category.slug, count: 0 },
    });
  } catch (error) {
    console.error("Create article category failed:", error);
    res.status(500).json({ error: "Could not create the category." });
  }
});

// DELETE /api/articles/admin/categories/:id
router.delete("/:id", async (req, res) => {
  try {
    const category = await prisma.articleCategory.findUnique({
      where: { id: req.params.id },
    });
    if (!category) {
      return res.status(404).json({ error: "Category not found." });
    }

    const inUse = await prisma.article.count({
      where: { category: category.slug },
    });
    if (inUse > 0) {
      return res.status(400).json({
        error: `This category is used by ${inUse} article(s). Move or delete them first.`,
      });
    }

    await prisma.articleCategory.delete({ where: { id: category.id } });
    res.json({ success: true });
  } catch (error) {
    console.error("Delete article category failed:", error);
    res.status(500).json({ error: "Could not delete the category." });
  }
});

module.exports = router;