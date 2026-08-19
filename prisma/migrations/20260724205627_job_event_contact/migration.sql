-- AlterTable
ALTER TABLE "JobApplicationEvent" ADD COLUMN     "contactId" TEXT;

-- CreateIndex
CREATE INDEX "JobApplicationEvent_contactId_idx" ON "JobApplicationEvent"("contactId");

-- AddForeignKey
ALTER TABLE "JobApplicationEvent" ADD CONSTRAINT "JobApplicationEvent_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
