-- AlterEnum
ALTER TYPE "QuoteStatus" ADD VALUE 'VALIDATED';

-- AlterTable
ALTER TABLE "InvoiceLine" ADD COLUMN     "detail" TEXT,
ADD COLUMN     "taxRate" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Quote" ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "generalConditions" TEXT,
ADD COLUMN     "validatedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "QuoteLine" ADD COLUMN     "detail" TEXT,
ADD COLUMN     "taxRate" DOUBLE PRECISION NOT NULL DEFAULT 0;
