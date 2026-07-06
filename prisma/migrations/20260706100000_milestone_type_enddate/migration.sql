-- CreateEnum
CREATE TYPE "MilestoneType" AS ENUM ('DEADLINE', 'MEETING', 'CALL', 'APPOINTMENT', 'ON_SITE', 'OTHER');

-- AlterTable
ALTER TABLE "Milestone" ADD COLUMN     "endDate" TIMESTAMP(3),
ADD COLUMN     "type" "MilestoneType" NOT NULL DEFAULT 'OTHER';

