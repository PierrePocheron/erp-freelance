-- AlterTable
ALTER TABLE "UserProfile" ADD COLUMN     "followUpDelayDays" INTEGER NOT NULL DEFAULT 7,
ADD COLUMN     "followUpTemplateId" TEXT;
