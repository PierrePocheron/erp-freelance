-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "jobApplicationId" TEXT;

-- CreateIndex
CREATE INDEX "Project_jobApplicationId_idx" ON "Project"("jobApplicationId");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_jobApplicationId_fkey" FOREIGN KEY ("jobApplicationId") REFERENCES "JobApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE;
