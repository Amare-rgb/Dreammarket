// lib/prisma.js
const { PrismaClient } = require('@prisma/client');

const isServerless = !!(
  process.env.NETLIFY ||
  process.env.NETLIFY_LOCAL ||
  process.env.VERCEL ||
  process.env.AWS_LAMBDA_FUNCTION_NAME ||
  process.env.LAMBDA_TASK_ROOT
);

// ✅ Singleton: one client per process / warm serverless container.
//    Multiple clients → multiple connection pools → "Too many connections".
const globalForPrisma = globalThis;

const prisma =
  globalForPrisma.__prisma ||
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['warn', 'error']
        : ['error'],
  });

// ✅ Cache in ALL environments.
//    On Netlify (production) the container is reused between warm invocations,
//    so caching avoids opening a new connection pool on every request.
globalForPrisma.__prisma = prisma;

// ✅ Eager connect ONLY for long-running servers (local / VPS).
//    On serverless, Prisma connects lazily on the first query. An eager
//    $connect() at cold start only adds latency and can cause unhandled
//    rejections if the DB is briefly unreachable.
//    ⚠️ We never call process.exit(1) here: server.js reports DB status and
//    /api/health must still be able to respond.
if (!isServerless && process.env.NODE_ENV !== 'test') {
  prisma
    .$connect()
    .then(() => {
      console.log('✅ Database connected successfully');
    })
    .catch((error) => {
      console.error('❌ Database connection failed:', error.message);
      console.error('Please check your DATABASE_URL in .env file');
    });
}

module.exports = prisma;