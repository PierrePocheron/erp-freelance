-- Réparation : la migration 20260609110000_recurring_invoice_lines est enregistrée comme
-- appliquée dans _prisma_migrations, mais son DDL n'a jamais été exécuté sur la base
-- (table et colonne absentes). Le code écrit pourtant dans cette table en SQL brut :
-- créer une facture récurrente avec des lignes échouait. Rejeu idempotent du même DDL.

ALTER TABLE "RecurringInvoice"
  ADD COLUMN IF NOT EXISTS "totalHT" DOUBLE PRECISION NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "RecurringInvoiceLine" (
  "id"                 TEXT NOT NULL,
  "recurringInvoiceId" TEXT NOT NULL,
  "productId"          TEXT,
  "description"        TEXT NOT NULL DEFAULT '',
  "detail"             TEXT,
  "quantity"           DOUBLE PRECISION NOT NULL DEFAULT 1,
  "unitPrice"          DOUBLE PRECISION NOT NULL DEFAULT 0,
  "taxRate"            DOUBLE PRECISION NOT NULL DEFAULT 0,
  "total"              DOUBLE PRECISION NOT NULL DEFAULT 0,
  CONSTRAINT "RecurringInvoiceLine_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "RecurringInvoiceLine"
    ADD CONSTRAINT "RecurringInvoiceLine_recurringInvoiceId_fkey"
    FOREIGN KEY ("recurringInvoiceId") REFERENCES "RecurringInvoice"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "RecurringInvoiceLine"
    ADD CONSTRAINT "RecurringInvoiceLine_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "RecurringInvoiceLine_recurringInvoiceId_idx"
  ON "RecurringInvoiceLine"("recurringInvoiceId");
