-- CreateEnum
CREATE TYPE "SkillFamily" AS ENUM ('FRONTEND', 'BACKEND', 'DEVOPS', 'MOBILE', 'DATABASE', 'SECURITY', 'TOOL', 'CONCEPT', 'OTHER');

-- AlterTable
ALTER TABLE "Skill" ADD COLUMN     "family" "SkillFamily";
