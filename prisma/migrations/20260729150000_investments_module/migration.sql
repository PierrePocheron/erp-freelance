-- CreateEnum
CREATE TYPE "InvestmentType" AS ENUM ('CROWDLENDING', 'CROWDFUNDING', 'IMMOBILIER', 'PEA', 'AUTRE');

-- CreateTable
CREATE TABLE "InvestmentPlatform" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "InvestmentType" NOT NULL DEFAULT 'CROWDLENDING',
    "url" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvestmentPlatform_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestmentEntry" (
    "id" TEXT NOT NULL,
    "platformId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "capital" DOUBLE PRECISION NOT NULL,
    "contribution" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvestmentEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InvestmentPlatform_userId_idx" ON "InvestmentPlatform"("userId");

-- CreateIndex
CREATE INDEX "InvestmentEntry_platformId_idx" ON "InvestmentEntry"("platformId");

-- CreateIndex
CREATE INDEX "InvestmentEntry_platformId_date_idx" ON "InvestmentEntry"("platformId", "date");

-- AddForeignKey
ALTER TABLE "InvestmentPlatform" ADD CONSTRAINT "InvestmentPlatform_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestmentEntry" ADD CONSTRAINT "InvestmentEntry_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "InvestmentPlatform"("id") ON DELETE CASCADE ON UPDATE CASCADE;
