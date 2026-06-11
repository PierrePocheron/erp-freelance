-- Add fiscalSourceId to Company (default billing/revenue fiscal source)
ALTER TABLE "Company" ADD COLUMN "fiscalSourceId" TEXT;

-- FK constraint
ALTER TABLE "Company" ADD CONSTRAINT "Company_fiscalSourceId_fkey"
  FOREIGN KEY ("fiscalSourceId") REFERENCES "FiscalSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Index for join performance
CREATE INDEX "Company_fiscalSourceId_idx" ON "Company"("fiscalSourceId");
