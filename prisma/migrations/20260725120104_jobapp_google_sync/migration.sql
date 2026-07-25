-- AlterTable
ALTER TABLE "JobApplication" ADD COLUMN     "googleEventId" TEXT,
ADD COLUMN     "googleSyncedAt" TIMESTAMP(3);
