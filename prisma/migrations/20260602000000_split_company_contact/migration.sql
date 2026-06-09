-- Sépare la société du contact : nouvelle table "Company" (1 société → N contacts),
-- champs structurés sur "Client" (firstName/lastName/label/companyId), puis backfill
-- des données existantes. Les colonnes "Client".name / "Client".company restent en
-- place comme caches d'affichage dénormalisés.

-- ─── Schéma ────────────────────────────────────────────────────────────────────

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "siret" TEXT,
    "vatNumber" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "address" TEXT,
    "postalCode" TEXT,
    "city" TEXT,
    "country" TEXT DEFAULT 'France',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Company_userId_idx" ON "Company"("userId");
CREATE UNIQUE INDEX "Company_userId_name_key" ON "Company"("userId", "name");

-- AlterTable
ALTER TABLE "Client" ADD COLUMN "firstName" TEXT;
ALTER TABLE "Client" ADD COLUMN "lastName" TEXT;
ALTER TABLE "Client" ADD COLUMN "label" TEXT;
ALTER TABLE "Client" ADD COLUMN "companyId" TEXT;

-- CreateIndex
CREATE INDEX "Client_companyId_idx" ON "Client"("companyId");

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Client" ADD CONSTRAINT "Client_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── Backfill des données existantes ──────────────────────────────────────────

-- 1. Une Company par (userId, nom de société) distinct et non vide.
INSERT INTO "Company" ("id", "userId", "name", "country", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, "userId", btrim("company"), 'France', now(), now()
FROM "Client"
WHERE "company" IS NOT NULL AND btrim("company") <> ''
GROUP BY "userId", btrim("company");

-- 2. Rattacher chaque contact à sa société.
UPDATE "Client" c
SET "companyId" = co."id"
FROM "Company" co
WHERE co."userId" = c."userId"
  AND co."name" = btrim(c."company")
  AND c."company" IS NOT NULL AND btrim(c."company") <> '';

-- 3. Normaliser le cache d'affichage `company` sur le nom dédupliqué.
UPDATE "Client"
SET "company" = btrim("company")
WHERE "company" IS NOT NULL AND "company" <> btrim("company");

-- 4. Remonter le SIRET du contact vers la société quand elle n'en a pas.
UPDATE "Company" co
SET "siret" = sub."siret"
FROM (
  SELECT DISTINCT ON ("companyId") "companyId", "siret"
  FROM "Client"
  WHERE "companyId" IS NOT NULL AND "siret" IS NOT NULL AND btrim("siret") <> ''
  ORDER BY "companyId", "updatedAt" DESC
) sub
WHERE co."id" = sub."companyId" AND co."siret" IS NULL;

-- 5. Éclater `name` en firstName / lastName (heuristique : premier espace).
--    Sans espace → tout dans lastName (rien n'est perdu).
UPDATE "Client"
SET "firstName" = CASE WHEN position(' ' in btrim("name")) > 0 THEN split_part(btrim("name"), ' ', 1) ELSE NULL END,
    "lastName"  = CASE WHEN position(' ' in btrim("name")) > 0 THEN btrim(substring(btrim("name") from position(' ' in btrim("name")) + 1)) ELSE btrim("name") END
WHERE "name" IS NOT NULL AND btrim("name") <> '';
