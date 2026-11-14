-- AlterTable
ALTER TABLE "products" ADD COLUMN "availabilityStatus" TEXT NOT NULL DEFAULT 'AVAILABLE',
ADD COLUMN "outOfStockAt" TIMESTAMP(3),
ADD COLUMN "autoRestock" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "restockAfterDays" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN "restockQuantity" INTEGER NOT NULL DEFAULT 10;

-- Backfill existing products based on current stock
UPDATE "products"
SET "availabilityStatus" = CASE
  WHEN "stock" > 0 THEN 'AVAILABLE'
  ELSE 'OUT_OF_STOCK_TEMPORARY'
END,
"outOfStockAt" = CASE
  WHEN "stock" <= 0 THEN NOW()
  ELSE NULL
END;
