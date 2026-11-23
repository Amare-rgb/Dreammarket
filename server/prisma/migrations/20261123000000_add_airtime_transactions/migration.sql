-- CreateTable
CREATE TABLE "airtime_transactions" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "network" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ETB',
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "requestId" TEXT,
    "error" TEXT,
    "sentBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "airtime_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "airtime_transactions_createdAt_idx" ON "airtime_transactions"("createdAt");

-- CreateIndex
CREATE INDEX "airtime_transactions_phone_idx" ON "airtime_transactions"("phone");
