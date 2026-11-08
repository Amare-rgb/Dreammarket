// server.js
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const http = require('http');
const prisma = require('./lib/prisma');

const app = express();
const PORT = process.env.PORT || 5000;
const isProd = process.env.NODE_ENV === 'production';

const platformName = 'dreamhost';
const isServerless = false;

app.set('trust proxy', 1);

// ═══════════════════════════════════════════════════════════
// PRODUCTION ORIGINS — EDIT to your real DreamHost domains
// ═══════════════════════════════════════════════════════════
const PRODUCTION_FRONTEND_ORIGINS = [
  'https://dreamhost.com',
  'https://www.dreamhost.com',
];

const PRODUCTION_BACKEND_ORIGINS = [
  'https://api.dreamhost.com',
  'https://dreamhost.com',
];

// ═══════════════════════════════════════════════════════════
// Collapse double slashes in the URL PATH
// ═══════════════════════════════════════════════════════════
app.use((req, res, next) => {
  const i = req.url.indexOf('?');
  const p = i === -1 ? req.url : req.url.slice(0, i);
  const query = i === -1 ? '' : req.url.slice(i);
  if (p.includes('//')) {
    req.url = p.replace(/\/{2,}/g, '/') + query;
  }
  next();
});

// ═══════════════════════════════════════════════════════════
// Slow request logger
// ═══════════════════════════════════════════════════════════
const SLOW_REQUEST_MS = Number(process.env.SLOW_REQUEST_MS) || 2000;

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    if (ms >= SLOW_REQUEST_MS) {
      console.warn(
        `🐢 Slow request: ${req.method} ${req.originalUrl} → ${res.statusCode} in ${ms}ms`
      );
    }
  });
  next();
});

// ═══════════════════════════════════════════════════════════
// CORS
// ═══════════════════════════════════════════════════════════
const stripSlash = (o) => String(o).trim().replace(/\/+$/, '');

const extraOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const allowedOrigins = new Set(
  [
    ...PRODUCTION_FRONTEND_ORIGINS,
    ...PRODUCTION_BACKEND_ORIGINS,

    process.env.CLIENT_URL,
    process.env.FRONTEND_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.VITE_API_URL,
    process.env.URL,
    process.env.DEPLOY_PRIME_URL,

    // Local dev
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:8888',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173',

    ...extraOrigins,
  ]
    .filter(Boolean)
    .map(stripSlash)
);

// Regex fallbacks
const CUSTOM_DOMAIN_REGEX = /^https?:\/\/([a-z0-9-]+\.)+[a-z]{2,}$/i;
const NGROK_REGEX = /^https?:\/\/[a-z0-9-]+(\.[a-z0-9-]+)*\.ngrok(-free)?\.(io|app|dev)$/i;
const LAN_REGEX = /^https?:\/\/(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/;

// Any domain is allowed by default (your current behavior).
// Set CORS_ALLOW_ANY_DOMAIN=false in .env to allow only the listed origins.
const ALLOW_ANY_DOMAIN = process.env.CORS_ALLOW_ANY_DOMAIN !== 'false';

function isOriginAllowed(origin) {
  if (!origin) return true; // curl / Postman / server-to-server

  const cleaned = stripSlash(origin);
  if (allowedOrigins.has(cleaned)) return true;

  // Custom domain (DreamHost)
  if (ALLOW_ANY_DOMAIN && CUSTOM_DOMAIN_REGEX.test(cleaned)) return true;

  // Dev-only
  if (!isProd) {
    if (NGROK_REGEX.test(cleaned)) return true;
    if (LAN_REGEX.test(cleaned)) return true;
  }

  return false;
}

const corsOptions = {
  origin(origin, callback) {
    if (isOriginAllowed(origin)) return callback(null, true);
    console.warn(`⚠️ CORS blocked for origin: ${origin}`);
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH', 'HEAD'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'Accept',
    'Origin',
    'X-Requested-With',
    'ngrok-skip-browser-warning',
    'Cache-Control',
    'Pragma',
    'X-CSRF-Token',
  ],
  exposedHeaders: ['Content-Disposition', 'Content-Length'],
  optionsSuccessStatus: 204,
  maxAge: 86400,
  preflightContinue: false,
};

// The cors middleware also answers OPTIONS preflight requests,
// so no separate app.options(...) routes are needed.
app.use(cors(corsOptions));

// ═══════════════════════════════════════════════════════════
// BODY PARSERS
// ═══════════════════════════════════════════════════════════
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ═══════════════════════════════════════════════════════════
// STATIC UPLOADS (local disk)
// ═══════════════════════════════════════════════════════════
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ═══════════════════════════════════════════════════════════
// IMPORT ROUTES
// ═══════════════════════════════════════════════════════════
const authRoutes = require('./routes/auth.routes');
const adminRoutes = require('./routes/admin.routes');
const adminDashboardRoutes = require('./routes/admin.dashboard');
const categoriesRoutes = require('./routes/categories.routes');
const productsRoutes = require('./routes/products.routes');
const uploadRoutes = require('./routes/upload.routes');
const usersRoutes = require('./routes/users.routes');
const settingsRoutes = require('./routes/settings.routes');
const profileRoutes = require('./routes/profile.routes');
const adminOrdersRoutes = require('./routes/admin.orders.routes');
const ordersRoutes = require('./routes/orders.routes');
// Article categories live inside this router (/api/articles/admin/categories)
const articlesRoutes = require('./routes/articles.routes');
const chatbotRoutes = require('./routes/chatbot.routes');

// ═══════════════════════════════════════════════════════════
// API ROUTER
// ═══════════════════════════════════════════════════════════
const apiRouter = express.Router();

apiRouter.use('/auth', authRoutes);
apiRouter.use('/admin/dashboard', adminDashboardRoutes);
apiRouter.use('/admin/settings', settingsRoutes);
apiRouter.use('/admin', adminRoutes);
apiRouter.use('/categories', categoriesRoutes);
apiRouter.use('/products', productsRoutes);
apiRouter.use('/upload', uploadRoutes);
apiRouter.use('/users', usersRoutes);
apiRouter.use('/profile', profileRoutes);
apiRouter.use('/admin/orders', adminOrdersRoutes);
apiRouter.use('/orders', ordersRoutes);
apiRouter.use('/articles', articlesRoutes);
apiRouter.use('/chatbot', chatbotRoutes);

// ═══════════════════════════════════════════════════════════
// HEALTH CHECK
// ═══════════════════════════════════════════════════════════
const healthHandler = async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const userCount = await prisma.user.count();

    res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      platform: platformName,
      storage: 'local',
      database: {
        connected: true,
        provider: 'postgresql-local',
        host: process.env.DB_HOST || 'localhost',
        userCount,
      },
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      database: { connected: false, error: error.message },
    });
  }
};

apiRouter.get('/health', healthHandler);

app.get('/healthz', (req, res) => {
  res.status(200).json({ status: 'OK', uptime: process.uptime() });
});

app.use('/api', apiRouter);

// ═══════════════════════════════════════════════════════════
// ROOT ROUTE
// ═══════════════════════════════════════════════════════════
const rootInfo = (req, res) => {
  res.json({
    name: 'DreamHost API Server',
    version: '1.0.0',
    status: 'Running',
    platform: platformName,
    storage: 'local',
    database: 'postgresql-local',
    endpoints: {
      auth: '/api/auth',
      admin: '/api/admin',
      adminDashboard: '/api/admin/dashboard',
      categories: '/api/categories',
      products: '/api/products',
      orders: '/api/admin/orders',
      articles: '/api/articles',
      articleCategories: '/api/articles/admin/categories',
      upload: '/api/upload',
      users: '/api/users',
      profile: '/api/profile',
      settings: '/api/admin/settings',
      chatbot: '/api/chatbot',
      health: '/api/health',
    },
  });
};
app.get('/', rootInfo);
app.get('/api', rootInfo);

// ═══════════════════════════════════════════════════════════
// 404 HANDLER
// ═══════════════════════════════════════════════════════════
app.use((req, res) => {
  console.log('❌ Route not found:', req.method, req.originalUrl);
  res.status(404).json({
    success: false,
    error: 'Route not found',
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    path: req.originalUrl,
    method: req.method,
  });
});

// ═══════════════════════════════════════════════════════════
// GLOBAL ERROR HANDLER
// ═══════════════════════════════════════════════════════════
app.use((err, req, res, next) => {
  console.error('❌ Global error handler:', err);
  if (res.headersSent) return next(err);

  if (err.type === 'entity.too.large') {
    return res.status(413).json({ success: false, error: 'File is too large. Max 10 MB.' });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, error: 'Invalid JSON in request body.' });
  }
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ success: false, error: 'File too large. Max 10 MB.' });
  }
  if (err.message && err.message.toLowerCase().includes('cors')) {
    return res.status(403).json({
      success: false,
      error: 'CORS policy blocked this request.',
      origin: req.headers.origin,
    });
  }

  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// ═══════════════════════════════════════════════════════════
// PROCESS-LEVEL SAFETY NETS
// ═══════════════════════════════════════════════════════════
process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled Promise Rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  process.exit(1);
});

// ═══════════════════════════════════════════════════════════
// STARTUP (DreamHost runs a persistent Node process)
// ═══════════════════════════════════════════════════════════
if (!isServerless) {
  let server;

  const gracefulShutdown = async (signal) => {
    console.log(`\n🛑 Received ${signal}. Shutting down gracefully...`);
    try {
      if (server) {
        await new Promise((resolve) => server.close(resolve));
        console.log('✅ HTTP server closed');
      }
      await prisma.$disconnect();
      console.log('✅ Local PostgreSQL disconnected');
      process.exit(0);
    } catch (err) {
      console.error('❌ Error during shutdown:', err);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  (async () => {
    const backendAlreadyRunning = await new Promise((resolve) => {
      const request = http.get(
        { hostname: '127.0.0.1', port: PORT, path: '/healthz', timeout: 2000 },
        (response) => {
          let body = '';
          response.setEncoding('utf8');
          response.on('data', (chunk) => {
            body += chunk;
          });
          response.on('end', () => {
            try {
              const health = JSON.parse(body);
              resolve(response.statusCode === 200 && health.status === 'OK');
            } catch {
              resolve(false);
            }
          });
        }
      );

      request.on('timeout', () => {
        request.destroy();
        resolve(false);
      });
      request.on('error', () => resolve(false));
    });

    if (backendAlreadyRunning) {
      console.log(
        `✅ DreamMore backend is already healthy on port ${PORT}; reusing the running server. Stop its original process before restarting it.`
      );
      return;
    }

    let dbConnected = false;
    try {
      await prisma.$connect();
      dbConnected = true;
      const userCount = await prisma.user.count();
      console.log(`✅ Local PostgreSQL connected (${userCount} users)`);

      const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
      console.log(
        adminUser
          ? `👤 Admin user exists: ${adminUser.email}`
          : '⚠️ No admin user found. Run: npx prisma db seed'
      );
    } catch (error) {
      console.error('❌ Local PostgreSQL connection failed:', error.message);
      console.error('Check DATABASE_URL in .env (e.g. postgresql://user:pass@localhost:5432/dbname)');
    }

    server = http.createServer(app);
    server.keepAliveTimeout = 65 * 1000;
    server.headersTimeout = 66 * 1000;
    server.on('error', (error) => {
      const portAlreadyInUse = error.code === 'EADDRINUSE';
      if (portAlreadyInUse) {
        console.warn(
          `⚠️ Port ${PORT} is already in use. The existing server will remain available; stop it from its original terminal before starting another instance.`
        );
      } else {
        console.error('❌ HTTP server failed to start:', error);
      }

      prisma
        .$disconnect()
        .catch((disconnectError) => {
          console.error('❌ Failed to disconnect the database:', disconnectError);
        })
        .finally(() => {
          process.exitCode = portAlreadyInUse ? 0 : 1;
        });
    });

    // ✅ Bind 0.0.0.0 so DreamHost's reverse proxy can reach the app
    server.listen(PORT, '0.0.0.0', () => {
      const backendUrl = process.env.BACKEND_URL || `http://localhost:${PORT}`;
      console.log('\n🏭 DreamHost Server running on ' + backendUrl);
      console.log('🌍 Environment: ' + (process.env.NODE_ENV || 'development'));
      console.log('🚆 Platform: ' + platformName);
      console.log('💾 Database: ' + (dbConnected ? 'Local PostgreSQL Connected ✅' : 'Not Connected ❌'));
      console.log('🔓 Allowed origins:');
      allowedOrigins.forEach((o) => console.log('   • ' + o));
    });
  })();
}

module.exports = app;