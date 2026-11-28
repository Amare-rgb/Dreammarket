const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
console.log(
  '🔐 GOOGLE_CLIENT_ID loaded:',
  process.env.GOOGLE_CLIENT_ID ? 'YES' : 'NO — check server/.env'
);
const express = require('express');
const cors = require('cors');
const http = require('http');
const prisma = require('./lib/prisma');
const { startRestockScheduler } = require('./lib/restock');

const app = express();
const PORT = process.env.PORT || 5000;
const isProd = process.env.NODE_ENV === 'production';

const platformName = 'dreamhost';
const isServerless = false;

app.set('trust proxy', 1);
const PRODUCTION_FRONTEND_ORIGINS = [
  'https://dreamhost.com',
  'https://www.dreamhost.com',
];

const PRODUCTION_BACKEND_ORIGINS = [
  'https://api.dreamhost.com',
  'https://dreamhost.com',
];
app.use((req, res, next) => {
  const i = req.url.indexOf('?');
  const p = i === -1 ? req.url : req.url.slice(0, i);
  const query = i === -1 ? '' : req.url.slice(i);
  if (p.includes('//')) {
    req.url = p.replace(/\/{2,}/g, '/') + query;
  }
  next();
});

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
const CUSTOM_DOMAIN_REGEX = /^https?:\/\/([a-z0-9-]+\.)+[a-z]{2,}$/i;
const NGROK_REGEX = /^https?:\/\/[a-z0-9-]+(\.[a-z0-9-]+)*\.ngrok(-free)?\.(io|app|dev)$/i;
const LAN_REGEX = /^https?:\/\/(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/;

const ALLOW_ANY_DOMAIN = process.env.CORS_ALLOW_ANY_DOMAIN !== 'false';

function isOriginAllowed(origin) {
  if (!origin) return true; 

  const cleaned = stripSlash(origin);
  if (allowedOrigins.has(cleaned)) return true;

  if (ALLOW_ANY_DOMAIN && CUSTOM_DOMAIN_REGEX.test(cleaned)) return true;

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

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
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
const articlesRoutes = require('./routes/articles.routes');
const chatbotRoutes = require('./routes/chatbot.routes');
const feedbackRoutes = require('./routes/feedback.routes');
const { publicRouter: deliveryPublicRoutes, adminRouter: deliveryAdminRoutes } = require('./routes/delivery.routes');
const rewardsRoutes = require('./routes/rewards.routes');
const { publicRouter: pagesPublicRoutes, adminRouter: pagesAdminRoutes } = require('./routes/pages.routes');
const { publicRouter: mediaPublicRoutes, adminRouter: mediaAdminRoutes } = require('./routes/media.routes');
const reviewRewardRoutes = require('./routes/reviewReward.routes');
const { router: paymentsRoutes, adminRouter: paymentsAdminRoutes } = require('./routes/payments.routes');
const smartEditRoutes = require('./routes/smartEdit.routes');
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
apiRouter.use('/feedback', feedbackRoutes);
apiRouter.use('/rewards', rewardsRoutes);
apiRouter.use('/delivery-regions', deliveryPublicRoutes);
apiRouter.use('/admin/delivery-regions', deliveryAdminRoutes);
apiRouter.use('/pages', pagesPublicRoutes);
apiRouter.use('/admin/pages', pagesAdminRoutes);
apiRouter.use('/media', mediaPublicRoutes);
apiRouter.use('/admin/media', mediaAdminRoutes);
apiRouter.use('/admin/review-reward', reviewRewardRoutes);
apiRouter.use('/payments', paymentsRoutes);
apiRouter.use('/admin/payments', paymentsAdminRoutes);
apiRouter.use('/admin/smart-edit', smartEditRoutes);
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
app.use((req, res) => {
  const url = req.originalUrl || '';
  const isScannerProbe =
    /\/(mcp|cgi|\.env|wp-|wordpress|phpmyadmin|vendor\/|\.git|loginMsg|boaform|hudson|solr|actuator|server-status|HNAP1|sdk\/|console\/)/i.test(
      url
    ) || /\.(php|asp|aspx|jsp|cgi|env|git|sql|bak|old|swp)$/i.test(url);

  if (!isScannerProbe) {
    console.log('❌ Route not found:', req.method, url);
  }

  res.status(404).json({
    success: false,
    error: 'Route not found',
    message: `Route not found: ${req.method} ${url}`,
    path: url,
    method: req.method,
  });
});
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
process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled Promise Rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  process.exit(1);
});
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
    server.listen(PORT, '0.0.0.0', () => {
      const backendUrl = process.env.BACKEND_URL || `http://localhost:${PORT}`;
      console.log('\n🏭 DreamHost Server running on ' + backendUrl);
      console.log('🌍 Environment: ' + (process.env.NODE_ENV || 'development'));
      console.log('🚆 Platform: ' + platformName);
      console.log('💾 Database: ' + (dbConnected ? 'Local PostgreSQL Connected ✅' : 'Not Connected ❌'));
      console.log('🔓 Allowed origins:');
      allowedOrigins.forEach((o) => console.log('   • ' + o));
      startRestockScheduler();
    });
  })();
}

module.exports = app;