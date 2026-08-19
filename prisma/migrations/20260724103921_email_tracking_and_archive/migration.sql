-- AlterTable
ALTER TABLE "EmailTemplate" ADD COLUMN     "archivedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Interaction" ADD COLUMN     "emailTemplateId" TEXT,
ADD COLUMN     "emailTemplateName" TEXT;

-- AddForeignKey
ALTER TABLE "Interaction" ADD CONSTRAINT "Interaction_emailTemplateId_fkey" FOREIGN KEY ("emailTemplateId") REFERENCES "EmailTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
