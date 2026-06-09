-- Module Revenus hors auto-entreprise
-- Deux nouveaux modèles : Revenue (entrée unique) + RecurringRevenue (modèle récurrent)

-- Enums
DO $$ BEGIN
  CREATE TYPE "RevenueType" AS ENUM (
    'SALARY', 'STUDY', 'INVESTMENT', 'RENTAL', 'PLATFORM', 'OTHER'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "RevenueStatus" AS ENUM ('PENDING', 'RECEIVED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Modèles récurrents (à créer avant Revenue pour la FK)
CREATE TABLE IF NOT EXISTS "RecurringRevenue" (
  "id"            TEXT NOT NULL,
  "userId"        TEXT NOT NULL,
  "type"          "RevenueType" NOT NULL,
  "label"         TEXT NOT NULL,
  "amount"        DOUBLE PRECISION NOT NULL,
  "currency"      TEXT NOT NULL DEFAULT 'EUR',
  "dayOfMonth"    INTEGER NOT NULL DEFAULT 1,
  "paymentMethod" TEXT,
  "notes"         TEXT,
  "isActive"      BOOLEAN NOT NULL DEFAULT true,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RecurringRevenue_pkey" PRIMARY KEY ("id")
);

-- Entrées de revenus
CREATE TABLE IF NOT EXISTS "Revenue" (
  "id"                 TEXT NOT NULL,
  "userId"             TEXT NOT NULL,
  "type"               "RevenueType" NOT NULL,
  "label"              TEXT NOT NULL,
  "amount"             DOUBLE PRECISION NOT NULL,
  "currency"           TEXT NOT NULL DEFAULT 'EUR',
  "status"             "RevenueStatus" NOT NULL DEFAULT 'PENDING',
  "receivedAt"         TIMESTAMP(3),
  "paymentMethod"      TEXT,
  "notes"              TEXT,
  "period"             TEXT,
  "recurringRevenueId" TEXT,
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Revenue_pkey" PRIMARY KEY ("id")
);

-- Clés étrangères
ALTER TABLE "RecurringRevenue"
  ADD CONSTRAINT "RecurringRevenue_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Revenue"
  ADD CONSTRAINT "Revenue_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Revenue"
  ADD CONSTRAINT "Revenue_recurringRevenueId_fkey"
  FOREIGN KEY ("recurringRevenueId") REFERENCES "RecurringRevenue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Index
CREATE INDEX IF NOT EXISTS "RecurringRevenue_userId_idx" ON "RecurringRevenue"("userId");
CREATE INDEX IF NOT EXISTS "Revenue_userId_idx" ON "Revenue"("userId");
CREATE INDEX IF NOT EXISTS "Revenue_recurringRevenueId_idx" ON "Revenue"("recurringRevenueId");
