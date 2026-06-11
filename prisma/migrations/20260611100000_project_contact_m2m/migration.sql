-- CreateEnum
CREATE TYPE "ProjectContactRole" AS ENUM ('CLIENT', 'COLLEAGUE', 'PARTNER', 'SUPPLIER', 'OTHER');

-- CreateTable
CREATE TABLE "ProjectContact" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "role" "ProjectContactRole" NOT NULL DEFAULT 'OTHER',
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectContact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectContact_projectId_clientId_key" ON "ProjectContact"("projectId", "clientId");

-- CreateIndex
CREATE INDEX "ProjectContact_clientId_idx" ON "ProjectContact"("clientId");

-- AddForeignKey
ALTER TABLE "ProjectContact" ADD CONSTRAINT "ProjectContact_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectContact" ADD CONSTRAINT "ProjectContact_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate existing contactId → ProjectContact (role CLIENT)
INSERT INTO "ProjectContact" ("id", "projectId", "clientId", "role", "createdAt")
SELECT gen_random_uuid()::text, p."id", p."contactId", 'CLIENT'::"ProjectContactRole", NOW()
FROM "Project" p
WHERE p."contactId" IS NOT NULL;

-- DropIndex
DROP INDEX IF EXISTS "Project_contactId_idx";

-- AlterTable: remove contactId
ALTER TABLE "Project" DROP COLUMN "contactId";
