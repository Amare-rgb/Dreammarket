// routes/settings.routes.js
const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const bcrypt = require('bcryptjs');
const { upload } = require('../middleware/upload');

// ═══════════════════════════════════════════════════════════
// Settings API — Dream More Affiliate Market
//  • Logo storage: local disk
//  • Database: Neon (PostgreSQL) via Prisma
// ═══════════════════════════════════════════════════════════

const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS) || 10;

// ── Parsers ─────────────────────────────────────────────────
const parseBoolean = (value) => {
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  return undefined;
};

const parseNumber = (value) => {
  if (value === undefined || value === null || value === '') return undefined;
  const num = parseFloat(value);
  return isNaN(num) ? undefined : num;
};

// ── Auth user helper (matches middleware/auth.js) ───────────
const getUserId = (req) => req.user?.id || null;

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

// ── Default settings — every field on the Settings model ────
const DEFAULT_SETTINGS = {
  siteName: 'Dream More Affiliate Market',
  siteDescription: 'Discover trusted products and great deals.',
  adminEmail: 'admin@alemayehplastic.com',
  adminPhone: '+251 900 000 000',
  address: 'Bahir Dar, Ethiopia',
  timezone: 'Africa/Addis_Ababa',
  dateFormat: 'DD/MM/YYYY',
  storeName: 'Dream More Affiliate Market',
  storeEmail: 'info@alemayehplastic.com',
  storePhone: '+251 900 000 000',
  storeAddress: 'Bahir Dar, Ethiopia',
  currency: 'ETB',
  taxRate: 15,
  logo: '',
  favicon: '',
  twoFactorAuth: false,
  sessionTimeout: 60,
  emailNotifications: true,
  orderNotifications: true,
  productNotifications: true,
  userNotifications: true,
  marketingEmails: false,
  themeColor: '#F47822',
  darkMode: false,
  contactEmail: 'support@alemayehplastic.com',
  contactPhone: '+251 900 000 000',
  contactAddress: 'Bahir Dar, Ethiopia',
  contactHours: 'Mon-Sat: 8:00 AM - 6:00 PM',
  contactMapEmbed: '',
  enableContactForm: true,
  enableWhatsApp: true,
  whatsAppNumber: '+251900000000',
  enableLiveChat: false,
  emergencyPhone: '+251 900 000 000',
  supportEmail: 'support@alemayehplastic.com',
  infoEmail: 'info@alemayehplastic.com',
};

function normalizeBrandSettings(settings) {
  return {
    ...settings,
    siteName:
      settings.siteName === 'Alemayehu Plastic Manufacturing'
        ? DEFAULT_SETTINGS.siteName
        : settings.siteName,
    siteDescription:
      settings.siteDescription ===
      'Quality plastic products manufactured in Ethiopia'
        ? DEFAULT_SETTINGS.siteDescription
        : settings.siteDescription,
    storeName:
      settings.storeName === 'Alemayehu Plastic Manufacturing'
        ? DEFAULT_SETTINGS.storeName
        : settings.storeName,
    themeColor: ['#e0a83c', '#f3733c', '#d85d32', '#eb6d3d'].includes(
      settings.themeColor?.toLowerCase()
    )
      ? DEFAULT_SETTINGS.themeColor
      : settings.themeColor,
  };
}

// ============================================================
// PUBLIC — GET /api/admin/settings/public
// ============================================================
router.get('/public', async (req, res) => {
  try {
    let settings = await prisma.settings.findFirst();

    if (!settings) {
      settings = await prisma.settings.create({ data: DEFAULT_SETTINGS });
    }

    settings = normalizeBrandSettings(settings);
    const publicSettings = {
      siteName: settings.siteName,
      siteDescription: settings.siteDescription,
      logo: settings.logo,
      favicon: settings.favicon,
      contactEmail: settings.contactEmail,
      contactPhone: settings.contactPhone,
      contactAddress: settings.contactAddress,
      contactHours: settings.contactHours,
      enableContactForm: settings.enableContactForm,
      enableWhatsApp: settings.enableWhatsApp,
      whatsAppNumber: settings.whatsAppNumber,
      themeColor: settings.themeColor,
    };

    res.setHeader(
      'Cache-Control',
      'no-store, no-cache, must-revalidate, private'
    );
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    res.json(publicSettings);
  } catch (error) {
    console.error('❌ Error fetching public settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// ============================================================
// ADMIN — GET /api/admin/settings
// ============================================================
router.get('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    let settings = await prisma.settings.findFirst();

    if (!settings) {
      settings = await prisma.settings.create({ data: DEFAULT_SETTINGS });
    }

    settings = normalizeBrandSettings(settings);
    res.setHeader(
      'Cache-Control',
      'no-store, no-cache, must-revalidate, private'
    );
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    res.json(settings);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// ============================================================
// ADMIN — POST /api/admin/settings (save + optional logo upload)
// Logo is uploaded to local disk.
// ============================================================
router.post(
  '/',
  requireAuth,
  requireAdmin,
  upload.single('logo'),
  async (req, res) => {
    try {
      let settings = await prisma.settings.findFirst();

      // ── Handle logo upload ────────────────────────────────
      let logoUrl = settings?.logo || '';

      if (req.file) {
        logoUrl = req.file.url;
      } else if (req.body.logo === '') {
        logoUrl = '';
      }

      // ── Build update payload ──────────────────────────────
      const updateData = {
        siteName:
          req.body.siteName ?? settings?.siteName ?? DEFAULT_SETTINGS.siteName,
        siteDescription:
          req.body.siteDescription ??
          settings?.siteDescription ??
          DEFAULT_SETTINGS.siteDescription,
        adminEmail:
          req.body.adminEmail ??
          settings?.adminEmail ??
          DEFAULT_SETTINGS.adminEmail,
        adminPhone:
          req.body.adminPhone ??
          settings?.adminPhone ??
          DEFAULT_SETTINGS.adminPhone,
        address:
          req.body.address ?? settings?.address ?? DEFAULT_SETTINGS.address,
        timezone:
          req.body.timezone ?? settings?.timezone ?? DEFAULT_SETTINGS.timezone,
        dateFormat:
          req.body.dateFormat ??
          settings?.dateFormat ??
          DEFAULT_SETTINGS.dateFormat,
        storeName:
          req.body.storeName ??
          settings?.storeName ??
          DEFAULT_SETTINGS.storeName,
        storeEmail:
          req.body.storeEmail ??
          settings?.storeEmail ??
          DEFAULT_SETTINGS.storeEmail,
        storePhone:
          req.body.storePhone ??
          settings?.storePhone ??
          DEFAULT_SETTINGS.storePhone,
        storeAddress:
          req.body.storeAddress ??
          settings?.storeAddress ??
          DEFAULT_SETTINGS.storeAddress,
        currency:
          req.body.currency ?? settings?.currency ?? DEFAULT_SETTINGS.currency,
        taxRate:
          parseNumber(req.body.taxRate) ??
          settings?.taxRate ??
          DEFAULT_SETTINGS.taxRate,
        logo: logoUrl,
        favicon:
          req.body.favicon ?? settings?.favicon ?? DEFAULT_SETTINGS.favicon,
        twoFactorAuth:
          parseBoolean(req.body.twoFactorAuth) ??
          settings?.twoFactorAuth ??
          DEFAULT_SETTINGS.twoFactorAuth,
        sessionTimeout:
          parseNumber(req.body.sessionTimeout) ??
          settings?.sessionTimeout ??
          DEFAULT_SETTINGS.sessionTimeout,
        emailNotifications:
          parseBoolean(req.body.emailNotifications) ??
          settings?.emailNotifications ??
          DEFAULT_SETTINGS.emailNotifications,
        orderNotifications:
          parseBoolean(req.body.orderNotifications) ??
          settings?.orderNotifications ??
          DEFAULT_SETTINGS.orderNotifications,
        productNotifications:
          parseBoolean(req.body.productNotifications) ??
          settings?.productNotifications ??
          DEFAULT_SETTINGS.productNotifications,
        userNotifications:
          parseBoolean(req.body.userNotifications) ??
          settings?.userNotifications ??
          DEFAULT_SETTINGS.userNotifications,
        marketingEmails:
          parseBoolean(req.body.marketingEmails) ??
          settings?.marketingEmails ??
          DEFAULT_SETTINGS.marketingEmails,
        themeColor:
          req.body.themeColor ??
          settings?.themeColor ??
          DEFAULT_SETTINGS.themeColor,
        darkMode:
          parseBoolean(req.body.darkMode) ??
          settings?.darkMode ??
          DEFAULT_SETTINGS.darkMode,
        contactEmail:
          req.body.contactEmail ??
          settings?.contactEmail ??
          DEFAULT_SETTINGS.contactEmail,
        contactPhone:
          req.body.contactPhone ??
          settings?.contactPhone ??
          DEFAULT_SETTINGS.contactPhone,
        contactAddress:
          req.body.contactAddress ??
          settings?.contactAddress ??
          DEFAULT_SETTINGS.contactAddress,
        contactHours:
          req.body.contactHours ??
          settings?.contactHours ??
          DEFAULT_SETTINGS.contactHours,
        contactMapEmbed:
          req.body.contactMapEmbed ??
          settings?.contactMapEmbed ??
          DEFAULT_SETTINGS.contactMapEmbed,
        enableContactForm:
          parseBoolean(req.body.enableContactForm) ??
          settings?.enableContactForm ??
          DEFAULT_SETTINGS.enableContactForm,
        enableWhatsApp:
          parseBoolean(req.body.enableWhatsApp) ??
          settings?.enableWhatsApp ??
          DEFAULT_SETTINGS.enableWhatsApp,
        whatsAppNumber:
          req.body.whatsAppNumber ??
          settings?.whatsAppNumber ??
          DEFAULT_SETTINGS.whatsAppNumber,
        enableLiveChat:
          parseBoolean(req.body.enableLiveChat) ??
          settings?.enableLiveChat ??
          DEFAULT_SETTINGS.enableLiveChat,
        emergencyPhone:
          req.body.emergencyPhone ??
          settings?.emergencyPhone ??
          DEFAULT_SETTINGS.emergencyPhone,
        supportEmail:
          req.body.supportEmail ??
          settings?.supportEmail ??
          DEFAULT_SETTINGS.supportEmail,
        infoEmail:
          req.body.infoEmail ??
          settings?.infoEmail ??
          DEFAULT_SETTINGS.infoEmail,
      };

      if (!settings) {
        settings = await prisma.settings.create({ data: updateData });
      } else {
        settings = await prisma.settings.update({
          where: { id: settings.id },
          data: updateData,
        });
      }

      res.setHeader(
        'Cache-Control',
        'no-store, no-cache, must-revalidate, private'
      );
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      res.json({
        success: true,
        settings,
        message: 'Settings saved successfully',
      });
    } catch (error) {
      console.error('❌ Error saving settings:', error);
      res.status(500).json({
        error: 'Failed to save settings',
        details:
          process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }
);

// ============================================================
// ADMIN — POST /api/admin/settings/change-password
// ============================================================
router.post(
  '/change-password',
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body || {};

      if (!currentPassword || !newPassword) {
        return res
          .status(400)
          .json({ error: 'Current password and new password are required' });
      }

      const pwErr = passwordError(newPassword);
      if (pwErr) {
        return res.status(400).json({ error: pwErr });
      }

      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const user = await prisma.user.findUnique({ where: { id: userId } });

      if (!user || !user.password) {
        return res.status(400).json({
          error: 'Cannot change password for this account',
        });
      }

      const isValidPassword = await bcrypt.compare(
        currentPassword,
        user.password
      );
      if (!isValidPassword) {
        return res
          .status(400)
          .json({ error: 'Current password is incorrect' });
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
      console.error('Error changing password:', error);
      res.status(500).json({ error: 'Failed to change password' });
    }
  }
);

// ============================================================
// ADMIN — POST /api/admin/settings/reset
// ============================================================
router.post('/reset', requireAuth, requireAdmin, async (req, res) => {
  try {
    const settings = await prisma.settings.findFirst();

    if (settings) {
      await prisma.settings.update({
        where: { id: settings.id },
        data: DEFAULT_SETTINGS,
      });
    } else {
      await prisma.settings.create({ data: DEFAULT_SETTINGS });
    }

    res.json({
      success: true,
      message: 'Settings reset to default successfully',
    });
  } catch (error) {
    console.error('Error resetting settings:', error);
    res.status(500).json({ error: 'Failed to reset settings' });
  }
});

module.exports = router;