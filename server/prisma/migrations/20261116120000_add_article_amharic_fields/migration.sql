-- AlterTable
ALTER TABLE "articles" ADD COLUMN "titleAm" TEXT,
ADD COLUMN "descriptionAm" TEXT,
ADD COLUMN "contentAm" TEXT,
ADD COLUMN "noteAm" TEXT;

-- AlterTable
ALTER TABLE "article_categories" ADD COLUMN "nameAm" TEXT;
