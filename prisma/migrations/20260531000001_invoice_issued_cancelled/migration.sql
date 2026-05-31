-- Migration: cycle de vie facture — états ÉMISE / ANNULÉE + dates associées
-- Une facture en DRAFT est éditable ; une fois émise (ISSUED) elle est figée.
-- Pour corriger, on l'annule (CANCELLED, conservée pour la séquence) et on duplique.

ALTER TYPE "InvoiceStatus" ADD VALUE IF NOT EXISTS 'ISSUED' AFTER 'DRAFT';
ALTER TYPE "InvoiceStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

ALTER TABLE "Invoice"
  ADD COLUMN IF NOT EXISTS "issuedAt"    TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3);
