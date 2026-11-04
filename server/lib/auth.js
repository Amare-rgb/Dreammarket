// lib/auth.js
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const prisma = require('./prisma');

// ═══════════════════════════════════════════════════════════
// JWT_SECRET must be set in .env — fail fast if missing.
// ═══════════════════════════════════════════════════════════
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error(
    '❌ JWT_SECRET is missing or too short (min 32 chars). ' +
      'Generate one with:\n' +
      "  node -e \"console.log(require('crypto').randomBytes(48).toString('hex'))\"\n" +
      'Then add to .env:  JWT_SECRET=<the-long-string>'
  );
}

const TOKEN_EXPIRY = process.env.JWT_EXPIRY || '7d';
const VERIFICATION_EXPIRY = '24h';
const RESET_EXPIRY = '1h';

// ============================================================
// getServerSession — verify JWT and return the user
// ============================================================
const getServerSession = async (req) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return null;

    const token = authHeader.split(' ')[1];
    if (!token) return null;

    const decoded = jwt.verify(token, JWT_SECRET);

    // Accept any of the ID field names used across the app
    const userId = decoded.userId || decoded.id || decoded.user_id;
    if (!userId) return null;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    });

    if (!user) return null;

    return { user };
  } catch (error) {
    console.error('❌ Session error:', error.message);
    return null;
  }
};

// ============================================================
// generateToken — sign a login token
// Includes id / userId / user_id so any consumer works.
// ============================================================
const generateToken = (userId, email, role, name = '') => {
  const payload = {
    id: userId,
    userId: userId,
    user_id: userId,
    email: email,
    role: String(role || 'USER').toUpperCase(),
    name: name,
  };

  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
};

// ============================================================
// Email verification token
// ============================================================
const generateVerificationToken = (email) =>
  jwt.sign(
    { email, purpose: 'email-verification' },
    JWT_SECRET,
    { expiresIn: VERIFICATION_EXPIRY }
  );

const verifyVerificationToken = (token) => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.purpose !== 'email-verification') return null;
    return decoded;
  } catch {
    return null;
  }
};

// ============================================================
// Password reset token
// ============================================================
const passwordVersion = (passwordHash) =>
  crypto
    .createHmac('sha256', JWT_SECRET)
    .update(String(passwordHash || ''))
    .digest('hex');

const generateResetToken = (email, passwordHash) =>
  jwt.sign(
    {
      email,
      purpose: 'password-reset',
      passwordVersion: passwordVersion(passwordHash),
    },
    JWT_SECRET,
    { expiresIn: RESET_EXPIRY }
  );

const verifyResetToken = (token, passwordHash) => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (
      decoded.purpose !== 'password-reset' ||
      typeof decoded.email !== 'string' ||
      typeof decoded.passwordVersion !== 'string'
    ) {
      return null;
    }
    if (passwordHash !== undefined) {
      const expectedVersion = Buffer.from(passwordVersion(passwordHash));
      const tokenVersion = Buffer.from(decoded.passwordVersion);
      if (
        tokenVersion.length !== expectedVersion.length ||
        !crypto.timingSafeEqual(tokenVersion, expectedVersion)
      ) {
        return null;
      }
    }
    return decoded;
  } catch {
    return null;
  }
};

// ⚠️ JWT_SECRET is intentionally NOT exported.
// No other module should need it — use the helper functions.
module.exports = {
  getServerSession,
  generateToken,
  generateVerificationToken,
  verifyVerificationToken,
  generateResetToken,
  verifyResetToken,
};