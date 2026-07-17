-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "cms" TEXT,
ADD COLUMN     "domainCreatedAt" TIMESTAMP(3),
ADD COLUMN     "enrichmentJson" TEXT,
ADD COLUMN     "performanceScore" INTEGER,
ADD COLUMN     "publicationManager" TEXT,
ADD COLUMN     "seoIssues" TEXT,
ADD COLUMN     "seoScore" INTEGER;

