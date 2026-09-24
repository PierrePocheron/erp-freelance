-- CreateEnum
CREATE TYPE "OrgLevel" AS ENUM ('DIRECTION', 'MANAGER', 'CDI', 'ALTERNANT', 'STAGIAIRE', 'PRESTATAIRE');

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "orgLevel" "OrgLevel",
ADD COLUMN     "teamId" TEXT;

-- CreateTable
CREATE TABLE "CompanyTeam" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyTeam_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompanyTeam_companyId_idx" ON "CompanyTeam"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyTeam_companyId_name_key" ON "CompanyTeam"("companyId", "name");

-- CreateIndex
CREATE INDEX "Client_teamId_idx" ON "Client"("teamId");

-- AddForeignKey
ALTER TABLE "CompanyTeam" ADD CONSTRAINT "CompanyTeam_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "CompanyTeam"("id") ON DELETE SET NULL ON UPDATE CASCADE;

