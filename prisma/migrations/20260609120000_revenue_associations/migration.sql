-- Association société / contact / projet sur Revenue et RecurringRevenue

ALTER TABLE "Revenue"
  ADD COLUMN IF NOT EXISTS "companyId" TEXT,
  ADD COLUMN IF NOT EXISTS "clientId"  TEXT,
  ADD COLUMN IF NOT EXISTS "projectId" TEXT;

ALTER TABLE "Revenue"
  ADD CONSTRAINT "Revenue_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Revenue"
  ADD CONSTRAINT "Revenue_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Revenue"
  ADD CONSTRAINT "Revenue_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "Revenue_companyId_idx" ON "Revenue"("companyId");
CREATE INDEX IF NOT EXISTS "Revenue_clientId_idx"  ON "Revenue"("clientId");
CREATE INDEX IF NOT EXISTS "Revenue_projectId_idx" ON "Revenue"("projectId");

-- RecurringRevenue

ALTER TABLE "RecurringRevenue"
  ADD COLUMN IF NOT EXISTS "companyId" TEXT,
  ADD COLUMN IF NOT EXISTS "clientId"  TEXT,
  ADD COLUMN IF NOT EXISTS "projectId" TEXT;

ALTER TABLE "RecurringRevenue"
  ADD CONSTRAINT "RecurringRevenue_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RecurringRevenue"
  ADD CONSTRAINT "RecurringRevenue_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RecurringRevenue"
  ADD CONSTRAINT "RecurringRevenue_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "RecurringRevenue_companyId_idx" ON "RecurringRevenue"("companyId");
CREATE INDEX IF NOT EXISTS "RecurringRevenue_clientId_idx"  ON "RecurringRevenue"("clientId");
CREATE INDEX IF NOT EXISTS "RecurringRevenue_projectId_idx" ON "RecurringRevenue"("projectId");
