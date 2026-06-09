-- Émetteur multi-société : nouvelle table "EmitterProfile" (N par user, un par
-- défaut), rattachée aux devis/factures via emitterProfileId. La numérotation
-- reste globale (portée par UserProfile), partagée entre tous les émetteurs.
-- L'identité émetteur existante (UserProfile) est recopiée dans un profil par
-- défaut ; les devis/factures existants y sont rattachés.

-- ─── Schéma ────────────────────────────────────────────────────────────────────

-- CreateTable
CREATE TABLE "EmitterProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "companyName" TEXT,
    "legalForm" TEXT,
    "siret" TEXT,
    "vatNumber" TEXT,
    "address" TEXT,
    "postalCode" TEXT,
    "city" TEXT,
    "country" TEXT NOT NULL DEFAULT 'France',
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "iban" TEXT,
    "bic" TEXT,
    "defaultConditions" TEXT,
    "legalMentions" TEXT,
    "pdfAccentColor" TEXT NOT NULL DEFAULT '#6366f1',
    "customAccentColors" TEXT,
    "logoUrl" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EmitterProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmitterProfile_userId_idx" ON "EmitterProfile"("userId");

-- AlterTable
ALTER TABLE "Quote" ADD COLUMN "emitterProfileId" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "emitterProfileId" TEXT;

-- AddForeignKey
ALTER TABLE "EmitterProfile" ADD CONSTRAINT "EmitterProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_emitterProfileId_fkey" FOREIGN KEY ("emitterProfileId") REFERENCES "EmitterProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_emitterProfileId_fkey" FOREIGN KEY ("emitterProfileId") REFERENCES "EmitterProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── Backfill ─────────────────────────────────────────────────────────────────

-- 1. Un EmitterProfile par défaut recopié depuis chaque UserProfile existant.
INSERT INTO "EmitterProfile" (
  "id", "userId", "name", "companyName", "siret", "address", "postalCode",
  "city", "country", "phone", "website", "iban", "bic", "defaultConditions",
  "pdfAccentColor", "customAccentColors", "logoUrl", "isDefault",
  "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  up."userId",
  COALESCE(NULLIF(btrim(up."companyName"), ''), 'Ma société'),
  up."companyName", up."siret", up."address", up."postalCode",
  up."city", COALESCE(up."country", 'France'), up."phone", up."website",
  up."iban", up."bic", up."defaultConditions",
  COALESCE(up."pdfAccentColor", '#6366f1'), up."customAccentColors", up."logoUrl",
  true, now(), now()
FROM "UserProfile" up;

-- 2. Rattacher tous les devis/factures existants au profil par défaut du user.
UPDATE "Quote" q
SET "emitterProfileId" = e."id"
FROM "EmitterProfile" e
WHERE e."userId" = q."userId" AND e."isDefault" = true;

UPDATE "Invoice" i
SET "emitterProfileId" = e."id"
FROM "EmitterProfile" e
WHERE e."userId" = i."userId" AND e."isDefault" = true;
