-- Project.companyId → Company : la société est maintenant l'entité principale d'un projet.
-- Project.clientId reste nullable pour la compatibilité facturation (Phase 2 le supprimera).

-- 1. Ajouter companyId
ALTER TABLE "Project" ADD COLUMN "companyId" TEXT;

-- 2. Backfill contactId depuis clientId (évite de perdre le lien contact)
UPDATE "Project" SET "contactId" = "clientId" WHERE "contactId" IS NULL;

-- 3. Backfill companyId depuis la société du contact actuel
UPDATE "Project" p
SET "companyId" = c."companyId"
FROM "Client" c
WHERE p."clientId" = c."id"
  AND c."companyId" IS NOT NULL;

-- 4. Rendre clientId nullable (backward-compat facturation)
ALTER TABLE "Project" ALTER COLUMN "clientId" DROP NOT NULL;

-- 5. FK + index pour companyId
ALTER TABLE "Project" ADD CONSTRAINT "Project_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Project_companyId_idx" ON "Project"("companyId");
