const { PrismaClient } = require('@prisma/client');
const isServerless = !!(
  process.env.NETLIFY ||
  process.env.NETLIFY_LOCAL ||
  process.env.VERCEL ||
  process.env.AWS_LAMBDA_FUNCTION_NAME ||
  process.env.LAMBDA_TASK_ROOT
);
const globalForPrisma = globalThis;
const prisma =
  globalForPrisma.__prisma ||
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['warn', 'error']
        : ['error'],
  });
globalForPrisma.__prisma = prisma;
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