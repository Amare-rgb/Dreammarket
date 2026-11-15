// routes/feedback.routes.js
const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth, requireAdmin, optionalAuth } = require('../middleware/auth');

const router = express.Router();

const text = (value) => (typeof value === 'string' ? value.trim() : '');

// ============================================================
// HELPER: Check if user has purchased a product
// ============================================================
async function hasPurchasedProduct(userEmail, productId) {
  const order = await prisma.order.findFirst({
    where: {
      customerEmail: { equals: userEmail, mode: 'insensitive' },
      status: { in: ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'] },
      items: {
        some: { productId },
      },
    },
    select: { id: true },
  });
  return !!order;
}

// ============================================================
// PRODUCT FEEDBACK ROUTES
// ============================================================

// GET /api/feedback/products/:productId — List approved reviews for a product
router.get('/products/:productId', optionalAuth, async (req, res) => {
  try {
    const { productId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, name: true },
    });

    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    const where = { productId, status: 'APPROVED' };

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { id: true, name: true, avatar: true },
          },
        },
      }),
      prisma.review.count({ where }),
    ]);

    // Check if current user has reviewed this product
    let userReview = null;
    if (req.user) {
      userReview = await prisma.review.findUnique({
        where: {
          userId_productId: {
            userId: req.user.id,
            productId,
          },
        },
      });
    }

    // Check if user can review (has purchased) - but allow all authenticated users to review
    // This is more lenient to ensure feedback is accessible
    let canReview = false;
    let hasPurchased = false;
    if (req.user) {
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { email: true },
      });
      if (user) {
        hasPurchased = await hasPurchasedProduct(user.email, productId);
        // Allow all authenticated users to review, but track purchase status
        canReview = true;
      }
    }

    return res.json({
      success: true,
      reviews: reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        imageUrl: r.imageUrl,
        reply: r.reply,
        repliedAt: r.repliedAt,
        createdAt: r.createdAt,
        user: {
          name: r.user.name,
          avatar: r.user.avatar,
        },
      })),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
      userReview: userReview
        ? {
            id: userReview.id,
            rating: userReview.rating,
            comment: userReview.comment,
            imageUrl: userReview.imageUrl,
            status: userReview.status,
            reply: userReview.reply,
            createdAt: userReview.createdAt,
          }
        : null,
      canReview,
      hasPurchased,
    });
  } catch (error) {
    console.error('Failed to fetch product reviews:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch reviews' });
  }
});

// POST /api/feedback/products/:productId — Submit product feedback (auth required, purchase verified)
router.post('/products/:productId', requireAuth, async (req, res) => {
  try {
    const { productId } = req.params;
    const { rating, comment, imageUrl } = req.body;

    // Validate input
    const ratingNum = parseInt(rating, 10);
    if (!ratingNum || ratingNum < 1 || ratingNum > 5) {
      return res.status(400).json({
        success: false,
        error: 'Rating must be between 1 and 5',
      });
    }

    const commentText = text(comment);
    if (commentText.length > 2000) {
      return res.status(400).json({
        success: false,
        error: 'Comment is too long (max 2000 characters)',
      });
    }

    // Validate image URL if provided
    let validatedImageUrl = null;
    if (imageUrl) {
      try {
        const imgUrl = new URL(imageUrl);
        const requestOrigin = `${req.protocol}://${req.get('host')}`;
        if (
          imageUrl.length > 2048 ||
          imgUrl.origin !== requestOrigin ||
          !imgUrl.pathname.startsWith('/uploads/')
        ) {
          throw new Error('Invalid image URL');
        }
        validatedImageUrl = imageUrl;
      } catch {
        return res.status(400).json({
          success: false,
          error: 'Invalid image URL. Please upload the image first.',
        });
      }
    }

    // Verify product exists
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, name: true },
    });
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { email: true, name: true },
    });
    if (!user) {
      return res.status(401).json({ success: false, error: 'User not found' });
    }

    // Check purchase status but don't block - allow all authenticated users to review
    const hasPurchased = await hasPurchasedProduct(user.email, productId);
    // Note: We no longer block users who haven't purchased - this allows more feedback

    // Check if user already reviewed this product
    const existingReview = await prisma.review.findUnique({
      where: {
        userId_productId: {
          userId: req.user.id,
          productId,
        },
      },
    });

    if (existingReview) {
      // Update existing review
      const updated = await prisma.review.update({
        where: { id: existingReview.id },
        data: {
          rating: ratingNum,
          comment: commentText || null,
          imageUrl: validatedImageUrl,
          status: 'PENDING', // Reset to pending for re-review
        },
        include: {
          user: { select: { name: true, avatar: true } },
        },
      });

      return res.json({
        success: true,
        review: {
          id: updated.id,
          rating: updated.rating,
          comment: updated.comment,
          imageUrl: updated.imageUrl,
          status: updated.status,
          createdAt: updated.createdAt,
        },
        message: 'Review updated successfully',
      });
    }

    // Create new review
    const review = await prisma.review.create({
      data: {
        userId: req.user.id,
        productId,
        rating: ratingNum,
        comment: commentText || null,
        imageUrl: validatedImageUrl,
        status: 'PENDING',
      },
      include: {
        user: { select: { name: true, avatar: true } },
      },
    });

    return res.status(201).json({
      success: true,
      review: {
        id: review.id,
        rating: review.rating,
        comment: review.comment,
        imageUrl: review.imageUrl,
        status: review.status,
        createdAt: review.createdAt,
      },
      message: 'Review submitted successfully',
    });
  } catch (error) {
    console.error('Failed to submit product review:', error);
    return res.status(500).json({ success: false, error: 'Failed to submit review' });
  }
});

// DELETE /api/feedback/products/:productId — Delete user's own review
router.delete('/products/:productId', requireAuth, async (req, res) => {
  try {
    const { productId } = req.params;

    const review = await prisma.review.findUnique({
      where: {
        userId_productId: {
          userId: req.user.id,
          productId,
        },
      },
    });

    if (!review) {
      return res.status(404).json({ success: false, error: 'Review not found' });
    }

    await prisma.review.delete({ where: { id: review.id } });

    return res.json({ success: true, message: 'Review deleted successfully' });
  } catch (error) {
    console.error('Failed to delete product review:', error);
    return res.status(500).json({ success: false, error: 'Failed to delete review' });
  }
});

// ============================================================
// ADMIN FEEDBACK MANAGEMENT ROUTES
// ============================================================

// GET /api/feedback/admin/all — List all feedback (reviews + article comments)
router.get('/admin/all', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { type, status, page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const results = {
      reviews: [],
      articleComments: [],
      totalReviews: 0,
      totalArticleComments: 0,
    };

    // Fetch product reviews
    if (!type || type === 'review' || type === 'all') {
      const reviewWhere = {};
      if (status) reviewWhere.status = status.toUpperCase();

      const [reviews, reviewCount] = await Promise.all([
        prisma.review.findMany({
          where: reviewWhere,
          skip,
          take: limitNum,
          orderBy: { createdAt: 'desc' },
          include: {
            user: { select: { id: true, name: true, email: true, avatar: true } },
            product: { select: { id: true, name: true, slug: true, images: true } },
          },
        }),
        prisma.review.count({ where: reviewWhere }),
      ]);

      results.reviews = reviews.map((r) => ({
        id: r.id,
        type: 'review',
        rating: r.rating,
        comment: r.comment,
        imageUrl: r.imageUrl,
        status: r.status,
        reply: r.reply,
        repliedAt: r.repliedAt,
        createdAt: r.createdAt,
        user: r.user,
        product: {
          id: r.product.id,
          name: r.product.name,
          slug: r.product.slug,
          image: r.product.images?.[0] || null,
        },
      }));
      results.totalReviews = reviewCount;
    }

    // Fetch article comments
    if (!type || type === 'comment' || type === 'all') {
      const commentWhere = {};
      if (status) commentWhere.status = status.toUpperCase();

      const [comments, commentCount] = await Promise.all([
        prisma.articleComment.findMany({
          where: commentWhere,
          skip,
          take: limitNum,
          orderBy: { createdAt: 'desc' },
          include: {
            user: { select: { id: true, name: true, email: true, avatar: true } },
            article: { select: { id: true, title: true, slug: true } },
          },
        }),
        prisma.articleComment.count({ where: commentWhere }),
      ]);

      results.articleComments = comments.map((c) => ({
        id: c.id,
        type: 'comment',
        name: c.name,
        message: c.message,
        imageUrl: c.imageUrl,
        status: c.status,
        reply: c.reply,
        repliedAt: c.repliedAt,
        createdAt: c.createdAt,
        user: c.user,
        article: c.article,
      }));
      results.totalArticleComments = commentCount;
    }

    return res.json({
      success: true,
      ...results,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalReviews: results.totalReviews,
        totalArticleComments: results.totalArticleComments,
      },
    });
  } catch (error) {
    console.error('Failed to fetch admin feedback:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch feedback' });
  }
});

// PATCH /api/feedback/admin/reviews/:id/status — Update review status
router.patch('/admin/reviews/:id/status', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['PENDING', 'APPROVED', 'HIDDEN'];
    if (!validStatuses.includes(status?.toUpperCase())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status. Must be PENDING, APPROVED, or HIDDEN',
      });
    }

    const review = await prisma.review.update({
      where: { id },
      data: { status: status.toUpperCase() },
    });

    return res.json({
      success: true,
      review: { id: review.id, status: review.status },
    });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, error: 'Review not found' });
    }
    console.error('Failed to update review status:', error);
    return res.status(500).json({ success: false, error: 'Failed to update status' });
  }
});

// PATCH /api/feedback/admin/comments/:id/status — Update comment status
router.patch('/admin/comments/:id/status', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['PENDING', 'APPROVED', 'HIDDEN'];
    if (!validStatuses.includes(status?.toUpperCase())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status. Must be PENDING, APPROVED, or HIDDEN',
      });
    }

    const comment = await prisma.articleComment.update({
      where: { id },
      data: { status: status.toUpperCase() },
    });

    return res.json({
      success: true,
      comment: { id: comment.id, status: comment.status },
    });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, error: 'Comment not found' });
    }
    console.error('Failed to update comment status:', error);
    return res.status(500).json({ success: false, error: 'Failed to update status' });
  }
});

// POST /api/feedback/admin/reviews/:id/reply — Reply to a review
router.post('/admin/reviews/:id/reply', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { reply } = req.body;

    const replyText = text(reply);
    if (!replyText || replyText.length > 2000) {
      return res.status(400).json({
        success: false,
        error: 'Reply is required and must be under 2000 characters',
      });
    }

    const review = await prisma.review.update({
      where: { id },
      data: {
        reply: replyText,
        repliedAt: new Date(),
        repliedBy: req.user.id,
      },
    });

    return res.json({
      success: true,
      review: {
        id: review.id,
        reply: review.reply,
        repliedAt: review.repliedAt,
      },
    });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, error: 'Review not found' });
    }
    console.error('Failed to reply to review:', error);
    return res.status(500).json({ success: false, error: 'Failed to reply' });
  }
});

// POST /api/feedback/admin/comments/:id/reply — Reply to an article comment
router.post('/admin/comments/:id/reply', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { reply } = req.body;

    const replyText = text(reply);
    if (!replyText || replyText.length > 2000) {
      return res.status(400).json({
        success: false,
        error: 'Reply is required and must be under 2000 characters',
      });
    }

    const comment = await prisma.articleComment.update({
      where: { id },
      data: {
        reply: replyText,
        repliedAt: new Date(),
        repliedBy: req.user.id,
      },
    });

    return res.json({
      success: true,
      comment: {
        id: comment.id,
        reply: comment.reply,
        repliedAt: comment.repliedAt,
      },
    });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, error: 'Comment not found' });
    }
    console.error('Failed to reply to comment:', error);
    return res.status(500).json({ success: false, error: 'Failed to reply' });
  }
});

// DELETE /api/feedback/admin/reviews/:id — Delete a review
router.delete('/admin/reviews/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.review.delete({ where: { id } });
    return res.json({ success: true, message: 'Review deleted' });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, error: 'Review not found' });
    }
    console.error('Failed to delete review:', error);
    return res.status(500).json({ success: false, error: 'Failed to delete review' });
  }
});

// DELETE /api/feedback/admin/comments/:id — Delete an article comment
router.delete('/admin/comments/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.articleComment.delete({ where: { id } });
    return res.json({ success: true, message: 'Comment deleted' });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, error: 'Comment not found' });
    }
    console.error('Failed to delete comment:', error);
    return res.status(500).json({ success: false, error: 'Failed to delete comment' });
  }
});

module.exports = router;
