-- AlterEnum: Add deposit workflow statuses to QuoteStatus
-- Already applied to Neon DB; this file tracks the change.
ALTER TYPE "QuoteStatus" ADD VALUE IF NOT EXISTS 'WAITING_DEPOSIT';
ALTER TYPE "QuoteStatus" ADD VALUE IF NOT EXISTS 'DEPOSIT_RECEIVED';
ALTER TYPE "QuoteStatus" ADD VALUE IF NOT EXISTS 'IN_PROGRESS';
