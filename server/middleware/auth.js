const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');
const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret-key';
const requireAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ 
        success: false,
        error: 'Authentication required. No token provided.',
        code: 'NO_TOKEN'
      });
    }
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log('🔑 Decoded token:', decoded);
    const userId = decoded.userId || decoded.id || decoded.user_id;
    if (!userId) {
      return res.status(401).json({ 
        success: false,
        error: 'Invalid token: No user ID found',
        code: 'INVALID_TOKEN'
      });
    }
    req.user = {
      id: userId,
      userId: userId,
      email: decoded.email,
      role: decoded.role || 'USER',
      name: decoded.name || decoded.userName || '',
      ...decoded
    };
    req.session = req.session || {};
    req.session.user = {
      id: userId,
      userId: userId,
      email: decoded.email,
      role: decoded.role || 'USER',
      name: decoded.name || decoded.userName || ''
    };
    console.log('✅ User authenticated:', req.user.email, 'Role:', req.user.role);
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      console.error('❌ JWT Error:', error.message);
      return res.status(401).json({ 
        success: false,
        error: 'Invalid token',
        code: 'INVALID_TOKEN'
      });
    }
    if (error.name === 'TokenExpiredError') {
      console.error('❌ Token Expired');
      return res.status(401).json({ 
        success: false,
        error: 'Token expired',
        code: 'TOKEN_EXPIRED'
      });
    }
    console.error('❌ Auth middleware error:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Authentication error',
      code: 'AUTH_ERROR'
    });
  }
};
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
      console.log('👤 Guest access (no token)');
      req.user = null;
      return next();
    }
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const userId = decoded.userId || decoded.id || decoded.user_id;
      if (!userId) {
        console.log('👤 Guest access (invalid token - no user ID)');
        req.user = null;
        return next();
      }
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
        }
      });

      if (!user) {
        console.log('👤 Guest access (user not found in DB)');
        req.user = null;
        return next();
      }
      req.user = {
        id: user.id,
        userId: user.id,
        email: user.email,
        role: user.role || 'USER',
        name: user.name || '',
        phone: user.phone || '',
        ...decoded
      };
      console.log('✅ Optional auth - User authenticated:', req.user.email);
      next();
    } catch (jwtError) {
      console.log('👤 Guest access (invalid token):', jwtError.message);
      req.user = null;
      next();
    }
  } catch (error) {
    console.error('❌ Optional auth error:', error);
    req.user = null;
    next();
  }
};
const requireAdmin = (req, res, next) => {
  requireAuth(req, res, () => {
    const userRole = req.user?.role?.toUpperCase();
    console.log('🛡️ Admin check - User role:', userRole);
    if (userRole !== 'ADMIN') {
      console.log('❌ Admin access denied for role:', userRole);
      return res.status(403).json({ 
        success: false,
        error: 'Admin access required',
        code: 'ADMIN_REQUIRED'
      });
    }
    console.log('✅ Admin access granted');
    next();
  });
};
const requireSeller = (req, res, next) => {
  requireAuth(req, res, () => {
    const userRole = req.user?.role?.toUpperCase();
    if (userRole !== 'SELLER' && userRole !== 'ADMIN') {
      return res.status(403).json({ 
        success: false,
        error: 'Seller access required',
        code: 'SELLER_REQUIRED'
      });
    }
    next();
  });
};
const requireSellerOrAdmin = (req, res, next) => {
  requireAuth(req, res, () => {
    const userRole = req.user?.role?.toUpperCase();
    if (userRole !== 'SELLER' && userRole !== 'ADMIN') {
      return res.status(403).json({ 
        success: false,
        error: 'Seller or Admin access required',
        code: 'SELLER_OR_ADMIN_REQUIRED'
      });
    }
    next();
  });
};
const authenticateToken = requireAuth;
const isAdmin = (req, res, next) => {
  const userRole = req.user?.role?.toUpperCase();
  if (!req.user || userRole !== 'ADMIN') {
    return res.status(403).json({ 
      success: false,
      error: 'Admin access required',
      code: 'ADMIN_REQUIRED'
    });
  }
  next();
};
module.exports = {
  requireAuth,
  optionalAuth,
  requireAdmin,
  requireSeller,
  requireSellerOrAdmin,
  authenticateToken,
  isAdmin
};