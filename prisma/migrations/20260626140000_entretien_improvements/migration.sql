-- LinkedIn URL sur les contacts
ALTER TABLE "Client" ADD COLUMN "linkedinUrl" TEXT;

-- Compte rendu et annulation sur les événements de candidature
ALTER TABLE "JobApplicationEvent" ADD COLUMN "outcome" TEXT;
ALTER TABLE "JobApplicationEvent" ADD COLUMN "cancelledAt" TIMESTAMP(3);
