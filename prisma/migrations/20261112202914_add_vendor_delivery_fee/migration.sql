-- AlterTable
ALTER TABLE "vendors"
ADD COLUMN "delivery_fee_amount" DECIMAL(12,2) NOT NULL DEFAULT 0;
