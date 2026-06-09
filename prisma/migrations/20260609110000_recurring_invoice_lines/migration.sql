-- Lignes de factures récurrentes (manquantes depuis l'origine)
-- + colonne totalHT sur RecurringInvoice

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

ALTER TABLE "RecurringInvoiceLine"
  ADD CONSTRAINT "RecurringInvoiceLine_recurringInvoiceId_fkey"
  FOREIGN KEY ("recurringInvoiceId")
  REFERENCES "RecurringInvoice"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RecurringInvoiceLine"
  ADD CONSTRAINT "RecurringInvoiceLine_productId_fkey"
  FOREIGN KEY ("productId")
  REFERENCES "Product"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "RecurringInvoiceLine_recurringInvoiceId_idx"
  ON "RecurringInvoiceLine"("recurringInvoiceId");
