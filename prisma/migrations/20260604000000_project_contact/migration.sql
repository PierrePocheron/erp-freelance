-- Contact optionnel sur un projet (personne chez le client)
ALTER TABLE "Project" ADD COLUMN "contactId" TEXT;
ALTER TABLE "Project" ADD CONSTRAINT "Project_contactId_fkey"
  FOREIGN KEY ("contactId") REFERENCES "Client"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Project_contactId_idx" ON "Project"("contactId");
