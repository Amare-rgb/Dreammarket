// routes/users.routes.js
const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// ═══════════════════════════════════════════════════════════
// Users API — Dream More Affiliate Market
//  • Uses Neon via Prisma
//  • No Order/OrderItem/Article/Cart/CartItem references
// ═══════════════════════════════════════════════════════════

// ── Auth user helper (matches middleware/auth.js) ──────────
const getAuthUserId = (req) => req.user?.id || null;

// ── Shared user select — matches schema fields only ─────────
const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  avatar: true,
  address: true,
  bio: true,
  createdAt: true,
  updatedAt: true,
};

// ============================================================
// GET /api/users — list all users (Admin only)
// ============================================================
router.get('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 10, role, search } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 10);
    const skip = (pageNum - 1) * limitNum;
    const take = limitNum;

    const where = {};

    if (role && role !== 'ALL') {
      where.role = role;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: USER_SELECT,
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      users,
      total,
      pages: Math.max(1, Math.ceil(total / limitNum)),
      page: pageNum,
      limit: limitNum,
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// ============================================================
// GET /api/users/:id — single user (Admin only)
// ============================================================
router.get('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: USER_SELECT,
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// ============================================================
// PATCH /api/users/:id — update user (Admin only)
// ============================================================
router.patch('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { role, name, phone, avatar, address, bio } = req.body || {};

    const existingUser = await prisma.user.findUnique({ where: { id } });

    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const updateData = {};

    if (role !== undefined) {
      const normalizedRole = String(role).toUpperCase();
      if (normalizedRole !== 'USER' && normalizedRole !== 'ADMIN') {
        return res.status(400).json({
          error: 'Invalid role. Allowed values: USER, ADMIN',
        });
      }
      updateData.role = normalizedRole;
    }

    if (name !== undefined) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;
    if (avatar !== undefined) updateData.avatar = avatar;
    if (address !== undefined) updateData.address = address;
    if (bio !== undefined) updateData.bio = bio;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No fields provided to update' });
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
      select: USER_SELECT,
    });

    res.json({
      success: true,
      user: updatedUser,
      message: 'User updated successfully',
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// ============================================================
// DELETE /api/users/:id — delete user (Admin only)
// Deletes related records that still exist on the schema:
//   reviews, addresses, chatMessages
// Order/OrderItem/Cart/CartItem have been removed from the schema.
// ============================================================
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const authUserId = getAuthUserId(req);

    if (authUserId && id === authUserId) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    const existingUser = await prisma.user.findUnique({ where: { id } });

    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // ── Delete related records first ────────────────────────
    await prisma.$transaction([
      prisma.review.deleteMany({ where: { userId: id } }),
      prisma.address.deleteMany({ where: { userId: id } }),
      prisma.chatMessage.deleteMany({ where: { userId: id } }),
      // Cascade in schema also removes profile / adminProfile
    ]);

    // ── Delete the user ─────────────────────────────────────
    await prisma.user.delete({ where: { id } });

    res.json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

module.exports = router;