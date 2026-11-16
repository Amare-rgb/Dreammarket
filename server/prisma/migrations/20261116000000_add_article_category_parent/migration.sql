-- AlterTable
ALTER TABLE "article_categories" ADD COLUMN "parentId" TEXT;

-- CreateIndex
CREATE INDEX "article_categories_parentId_idx" ON "article_categories"("parentId");

-- AddForeignKey
ALTER TABLE "article_categories" ADD CONSTRAINT "article_categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "article_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
