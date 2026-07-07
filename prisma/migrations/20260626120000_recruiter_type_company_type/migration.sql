-- AlterEnum: ajoute RECRUITER à ClientType
ALTER TYPE "ClientType" ADD VALUE 'RECRUITER';

-- CreateEnum: CompanyType
CREATE TYPE "CompanyType" AS ENUM ('CLIENT', 'ESN', 'RECRUTEMENT', 'PARTENAIRE', 'FOURNISSEUR', 'AUTRE');

-- AlterTable: ajoute companyType à Company
ALTER TABLE "Company" ADD COLUMN "companyType" "CompanyType";
