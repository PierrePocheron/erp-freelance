-- CreateEnum
CREATE TYPE "BillingType" AS ENUM ('ONE_SHOT', 'MONTHLY', 'QUARTERLY', 'YEARLY');

-- AlterEnum
ALTER TYPE "ProductUnit" ADD VALUE 'FLAT';

-- AlterEnum
ALTER TYPE "QuoteStatus" ADD VALUE 'SIGNED';

-- AlterTable Product
ALTER TABLE "Product" ADD COLUMN "billingType" "BillingType" NOT NULL DEFAULT 'ONE_SHOT';
ALTER TABLE "Product" ADD COLUMN "defaultTaxRate" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable QuoteLine
ALTER TABLE "QuoteLine" ADD COLUMN "billingType" "BillingType" NOT NULL DEFAULT 'ONE_SHOT';

-- AlterTable UserProfile
ALTER TABLE "UserProfile" ADD COLUMN "defaultConditions" TEXT;
ALTER TABLE "UserProfile" ADD COLUMN "pdfAccentColor" TEXT NOT NULL DEFAULT '#6366f1';
ALTER TABLE "UserProfile" ADD COLUMN "logoUrl" TEXT;
