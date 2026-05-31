-- Migration: figer le PDF d'une facture à l'émission
-- À l'émission (ISSUED), le PDF est rendu une fois et stocké sur Blob.
-- pdfUrl pointe vers ce document immuable ; tant qu'il est null, la facture
-- (brouillon) est rendue à la volée.

ALTER TABLE "Invoice"
  ADD COLUMN IF NOT EXISTS "pdfUrl" TEXT;
