-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "urssafPeriod" TEXT;

-- CreateIndex
CREATE INDEX "Task_userId_urssafPeriod_idx" ON "Task"("userId", "urssafPeriod");

