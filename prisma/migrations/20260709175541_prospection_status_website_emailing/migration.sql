-- CreateEnum
CREATE TYPE "ProspectStatus" AS ENUM ('TO_CONTACT', 'CONTACTED', 'REPLIED', 'IN_DISCUSSION', 'WON', 'LOST');

-- CreateEnum
CREATE TYPE "WebsiteType" AS ENUM ('SHOWCASE', 'ECOMMERCE', 'BLOG_CONTENT', 'OUTDATED', 'OTHER');

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "businessDescription" TEXT,
ADD COLUMN     "prospectStatus" "ProspectStatus" NOT NULL DEFAULT 'TO_CONTACT',
ADD COLUMN     "region" TEXT,
ADD COLUMN     "websitePagesApprox" INTEGER,
ADD COLUMN     "websiteType" "WebsiteType",
ADD COLUMN     "websiteUrl" TEXT;

-- AlterTable
ALTER TABLE "EmailLog" ADD COLUMN     "clientId" TEXT;

-- CreateTable
CREATE TABLE "EmailTemplate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailTemplate_userId_idx" ON "EmailTemplate"("userId");

-- CreateIndex
CREATE INDEX "EmailLog_clientId_idx" ON "EmailLog"("clientId");

-- AddForeignKey
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailTemplate" ADD CONSTRAINT "EmailTemplate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill : reporte l'ancien pipeline 10 étapes (prospectStage) sur le nouveau
-- statut 6 valeurs. NO_RESPONSE est un "contacté sans suite" → CONTACTED ;
-- les étapes de négociation avancée → IN_DISCUSSION ; ON_HOLD → LOST (pas
-- d'état "pause" dans le nouveau pipeline, l'ancienne valeur reste lisible
-- dans prospectStage si besoin).
UPDATE "Client" SET "prospectStatus" = CASE "prospectStage"
  WHEN 'IDENTIFIED'    THEN 'TO_CONTACT'::"ProspectStatus"
  WHEN 'CONTACTED'     THEN 'CONTACTED'::"ProspectStatus"
  WHEN 'NO_RESPONSE'   THEN 'CONTACTED'::"ProspectStatus"
  WHEN 'REPLIED'       THEN 'REPLIED'::"ProspectStatus"
  WHEN 'MEETING'       THEN 'IN_DISCUSSION'::"ProspectStatus"
  WHEN 'PROPOSAL_SENT' THEN 'IN_DISCUSSION'::"ProspectStatus"
  WHEN 'NEGOTIATION'   THEN 'IN_DISCUSSION'::"ProspectStatus"
  WHEN 'WON'           THEN 'WON'::"ProspectStatus"
  ELSE 'LOST'::"ProspectStatus"
END
WHERE "type" = 'PROSPECT';
