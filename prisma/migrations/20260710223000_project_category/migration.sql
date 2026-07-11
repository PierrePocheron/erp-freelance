-- CreateEnum
CREATE TYPE "ProjectCategory" AS ENUM ('DEV', 'ETUDE', 'EVENEMENTIEL', 'FORMATION', 'PROSPECTION', 'AUTRE');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "category" "ProjectCategory" NOT NULL DEFAULT 'AUTRE';
