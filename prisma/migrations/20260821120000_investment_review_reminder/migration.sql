-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "investmentPeriod" TEXT,
ADD COLUMN     "investmentPlatformId" TEXT;

-- AlterTable
ALTER TABLE "UserProfile" ADD COLUMN     "investmentReviewDay" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "investmentReviewReminder" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Task_userId_investmentPeriod_idx" ON "Task"("userId", "investmentPeriod");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_investmentPlatformId_fkey" FOREIGN KEY ("investmentPlatformId") REFERENCES "InvestmentPlatform"("id") ON DELETE CASCADE ON UPDATE CASCADE;
