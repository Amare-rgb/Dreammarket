// routes/profile.routes.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');

// ═══════════════════════════════════════════════════════════
// Profile API — Dream More Affiliate Market
//  • Uses the shared auth middleware (same as the rest of the app)
//  • No Order/Article/Cart references
// ═══════════════════════════════════════════════════════════

const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS) || 10;

// Same password rule as auth.routes.js
const passwordError = (pw) => {
  if (typeof pw !== 'string' || pw.length < 8) {
    return 'Password must be at least 8 characters';
  }
  if (pw.length > 128) {
    return 'Password is too long (maximum 128 characters)';
  }
  if (!/\d/.test(pw)) {
    return 'Password must contain at least one number';
  }
  return null;
};

// ============================================================
// GET /api/profile/me — current user profile
// ============================================================
router.get('/me', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res
        .status(401)
        .json({ success: false, message: 'Unauthorized' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        address: true,
        bio: true,
        role: true,
        avatar: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, user });
  } catch (error) {
    console.error('❌ Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
});

// ============================================================
// PUT /api/profile/update — update user profile
// ============================================================
router.put('/update', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res
        .status(401)
        .json({ success: false, message: 'Unauthorized' });
    }

    const { name, phone, address, bio, avatar } = req.body || {};

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;
    if (address !== undefined) updateData.address = address;
    if (bio !== undefined) updateData.bio = bio;
    if (avatar !== undefined) updateData.avatar = avatar;

    const select = {
      id: true,
      name: true,
      email: true,
      phone: true,
      address: true,
      bio: true,
      role: true,
      avatar: true,
      createdAt: true,
      updatedAt: true,
    };

    if (Object.keys(updateData).length === 0) {
      const currentUser = await prisma.user.findUnique({
        where: { id: userId },
        select,
      });

      if (!currentUser) {
        return res
          .status(404)
          .json({ success: false, message: 'User not found' });
      }

      return res.json({
        success: true,
        message: 'No changes provided',
        user: currentUser,
      });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select,
    });

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: updatedUser,
    });
  } catch (error) {
    console.error('❌ Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
});

// ============================================================
// PUT /api/profile/change-password
// ============================================================
router.put('/change-password', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res
        .status(401)
        .json({ success: false, message: 'Unauthorized' });
    }

    const { currentPassword, newPassword } = req.body || {};

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide current and new password',
      });
    }

    const pwErr = passwordError(newPassword);
    if (pwErr) {
      return res.status(400).json({ success: false, message: pwErr });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.password) {
      return res.status(400).json({
        success: false,
        message: 'Cannot change password for this account',
      });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect',
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    res.json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    console.error('❌ Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
});

module.exports = router;