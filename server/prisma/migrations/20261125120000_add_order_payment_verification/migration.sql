-- AlterTable
ALTER TABLE "orders" ADD COLUMN "transactionRef" TEXT;
ALTER TABLE "orders" ADD COLUMN "paymentScreenshotUrl" TEXT;
ALTER TABLE "orders" ADD COLUMN "paymentStatus" TEXT DEFAULT 'UNVERIFIED';
ALTER TABLE "orders" ADD COLUMN "verificationMethod" TEXT;
ALTER TABLE "orders" ADD COLUMN "verificationNotes" TEXT;
ALTER TABLE "orders" ADD COLUMN "verifiedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "orders_transactionRef_key" ON "orders"("transactionRef");
