-- AlterTable
ALTER TABLE "JobApplication" ADD COLUMN     "competencyDossierUrl" TEXT,
ADD COLUMN     "competencyDossierValidated" BOOLEAN NOT NULL DEFAULT false;
