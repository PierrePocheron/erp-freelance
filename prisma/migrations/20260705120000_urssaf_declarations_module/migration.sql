-- CreateEnum
CREATE TYPE "FiscalCategory" AS ENUM ('BNC', 'BIC_SERVICES', 'BIC_SALES');

-- CreateEnum
CREATE TYPE "UrssafDeclarationStatus" AS ENUM ('DRAFT', 'DECLARED', 'PAID');

-- CreateEnum
CREATE TYPE "DeclarationFrequency" AS ENUM ('MONTHLY', 'QUARTERLY');

-- AlterTable
ALTER TABLE "UserProfile" ADD COLUMN     "legalStatus" TEXT NOT NULL DEFAULT 'AUTO_ENTREPRENEUR',
ADD COLUMN     "rateBICSalesCFP" DOUBLE PRECISION NOT NULL DEFAULT 0.10,
ADD COLUMN     "rateBICSalesCotisations" DOUBLE PRECISION NOT NULL DEFAULT 12.30,
ADD COLUMN     "rateBICSalesVL" DOUBLE PRECISION NOT NULL DEFAULT 1.00,
ADD COLUMN     "rateBICServicesCFP" DOUBLE PRECISION NOT NULL DEFAULT 0.10,
ADD COLUMN     "rateBICServicesCotisations" DOUBLE PRECISION NOT NULL DEFAULT 21.20,
ADD COLUMN     "rateBICServicesVL" DOUBLE PRECISION NOT NULL DEFAULT 1.70,
ADD COLUMN     "rateBNCCFP" DOUBLE PRECISION NOT NULL DEFAULT 0.20,
ADD COLUMN     "rateBNCCotisations" DOUBLE PRECISION NOT NULL DEFAULT 25.60,
ADD COLUMN     "rateBNCVL" DOUBLE PRECISION NOT NULL DEFAULT 2.20,
ADD COLUMN     "urssafFrequency" "DeclarationFrequency" NOT NULL DEFAULT 'QUARTERLY',
ADD COLUMN     "versementLiberatoire" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "defaultFiscalCategory" "FiscalCategory";

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "urssafExcluded" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "UrssafDeclaration" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "status" "UrssafDeclarationStatus" NOT NULL DEFAULT 'DRAFT',
    "declaredAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "amountBNC" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "amountBICServices" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "amountBICSales" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cotisations" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cfp" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "versementLiberatoire" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UrssafDeclaration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UrssafDeclarationLine" (
    "id" TEXT NOT NULL,
    "declarationId" TEXT NOT NULL,
    "category" "FiscalCategory" NOT NULL,
    "invoiceId" TEXT,
    "revenueId" TEXT,
    "label" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "UrssafDeclarationLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UrssafDeclaration_userId_idx" ON "UrssafDeclaration"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UrssafDeclaration_userId_period_key" ON "UrssafDeclaration"("userId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "UrssafDeclarationLine_invoiceId_key" ON "UrssafDeclarationLine"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "UrssafDeclarationLine_revenueId_key" ON "UrssafDeclarationLine"("revenueId");

-- CreateIndex
CREATE INDEX "UrssafDeclarationLine_declarationId_idx" ON "UrssafDeclarationLine"("declarationId");

-- AddForeignKey
ALTER TABLE "UrssafDeclaration" ADD CONSTRAINT "UrssafDeclaration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UrssafDeclarationLine" ADD CONSTRAINT "UrssafDeclarationLine_declarationId_fkey" FOREIGN KEY ("declarationId") REFERENCES "UrssafDeclaration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UrssafDeclarationLine" ADD CONSTRAINT "UrssafDeclarationLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UrssafDeclarationLine" ADD CONSTRAINT "UrssafDeclarationLine_revenueId_fkey" FOREIGN KEY ("revenueId") REFERENCES "Revenue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

