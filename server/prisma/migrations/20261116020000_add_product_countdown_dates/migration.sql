-- AlterTable
ALTER TABLE "products"
  ADD COLUMN "availableAt" TIMESTAMP(3),
  ADD COLUMN "restockDate" TIMESTAMP(3),
  ADD COLUMN "saleEndDate" TIMESTAMP(3);
