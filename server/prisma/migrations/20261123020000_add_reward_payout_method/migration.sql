-- AlterTable
ALTER TABLE "reward_rules" ADD COLUMN "payoutMethod" TEXT NOT NULL DEFAULT 'AUTO';
ALTER TABLE "reward_rules" ADD COLUMN "payoutDetails" TEXT;
