-- Migration: ajouter date d'achat + durée aux renouvellements
-- Permet de calculer/tracer l'échéance d'un domaine ou hébergement

ALTER TABLE "Renewal"
  ADD COLUMN IF NOT EXISTS "purchasedAt"  TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "periodMonths" INTEGER;
