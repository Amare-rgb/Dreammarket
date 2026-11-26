-- Module 1: Review rewards + wallet ledger
CREATE TABLE IF NOT EXISTS "review_reward_configs" (
    "id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "minRating" INTEGER NOT NULL DEFAULT 4,
    "amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'ETB',
    "note" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,
    CONSTRAINT "review_reward_configs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "reward_transactions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'CREDIT',
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ETB',
    "source" TEXT NOT NULL,
    "reviewId" TEXT,
    "productId" TEXT,
    "orderId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "reward_transactions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "reward_transactions_userId_productId_source_key"
    ON "reward_transactions"("userId", "productId", "source");
CREATE INDEX IF NOT EXISTS "reward_transactions_userId_createdAt_idx"
    ON "reward_transactions"("userId", "createdAt");
ALTER TABLE "reward_transactions"
    ADD CONSTRAINT "reward_transactions_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reward_transactions"
    ADD CONSTRAINT "reward_transactions_reviewId_fkey"
    FOREIGN KEY ("reviewId") REFERENCES "reviews"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "reward_transactions"
    ADD CONSTRAINT "reward_transactions_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "reward_transactions"
    ADD CONSTRAINT "reward_transactions_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Module 2: structured delivery region location
ALTER TABLE "delivery_regions"
    ADD COLUMN IF NOT EXISTS "region" TEXT,
    ADD COLUMN IF NOT EXISTS "woreda" TEXT,
    ADD COLUMN IF NOT EXISTS "kebele" TEXT,
    ADD COLUMN IF NOT EXISTS "landmark" TEXT,
    ADD COLUMN IF NOT EXISTS "latitude" DECIMAL(10,7),
    ADD COLUMN IF NOT EXISTS "longitude" DECIMAL(10,7);

-- Module 3: payment verification requests + chat
CREATE TABLE IF NOT EXISTS "payment_verification_requests" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "transactionRef" TEXT NOT NULL,
    "receiptUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "adminNote" TEXT,
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "payment_verification_requests_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "payment_verification_requests_status_createdAt_idx"
    ON "payment_verification_requests"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "payment_verification_requests_userId_idx"
    ON "payment_verification_requests"("userId");
ALTER TABLE "payment_verification_requests"
    ADD CONSTRAINT "payment_verification_requests_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payment_verification_requests"
    ADD CONSTRAINT "payment_verification_requests_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "payment_verification_messages" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "senderRole" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "payment_verification_messages_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "payment_verification_messages_requestId_createdAt_idx"
    ON "payment_verification_messages"("requestId", "createdAt");
ALTER TABLE "payment_verification_messages"
    ADD CONSTRAINT "payment_verification_messages_requestId_fkey"
    FOREIGN KEY ("requestId") REFERENCES "payment_verification_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Affiliate attribution on orders + users
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "affiliateCode" TEXT;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "affiliateCommission" DECIMAL(12,2);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "affiliateCode" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "users_affiliateCode_key" ON "users"("affiliateCode");
