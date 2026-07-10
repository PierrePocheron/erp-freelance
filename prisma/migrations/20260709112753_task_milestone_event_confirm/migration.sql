-- AlterEnum
ALTER TYPE "MilestoneStatus" ADD VALUE 'CANCELLED';

-- AlterEnum
ALTER TYPE "TaskStatus" ADD VALUE 'CANCELLED';

-- AlterTable
ALTER TABLE "CalendarEvent" ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "outcome" TEXT;

-- AlterTable
ALTER TABLE "Milestone" ADD COLUMN     "googleEventId" TEXT,
ADD COLUMN     "googleSyncedAt" TIMESTAMP(3),
ADD COLUMN     "outcome" TEXT;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "googleEventId" TEXT,
ADD COLUMN     "googleSyncedAt" TIMESTAMP(3),
ADD COLUMN     "outcome" TEXT;
