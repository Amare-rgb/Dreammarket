-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('PENDING', 'PUBLISHED');

-- AlterTable: existing products stay live, new products are created as PENDING by the API
ALTER TABLE "products" ADD COLUMN "status" "ProductStatus" NOT NULL DEFAULT 'PUBLISHED';
