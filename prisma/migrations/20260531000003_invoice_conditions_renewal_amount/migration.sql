-- Migration: conditions générales sur facture + montant sur renouvellement
-- generalConditions : clauses (reconduction, domaine…) rendues en bas du PDF.
-- Renewal.amount : prix de la période, pour facturer un renouvellement.

ALTER TABLE "Invoice"
  ADD COLUMN IF NOT EXISTS "generalConditions" TEXT;

ALTER TABLE "Renewal"
  ADD COLUMN IF NOT EXISTS "amount" DOUBLE PRECISION;
