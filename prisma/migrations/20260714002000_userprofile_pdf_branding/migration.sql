-- Branding PDF du template « Pedro » (UserProfile) — additive only.
-- NB : le diff brut contre la base incluait aussi des DROP liés à une dérive
-- indépendante (PushSubscription, Client.jobTitle) — volontairement exclus.

-- AlterTable
ALTER TABLE "UserProfile" ADD COLUMN     "pdfBackgroundColor" TEXT NOT NULL DEFAULT '#FAF6EE',
ADD COLUMN     "pdfBankName" TEXT,
ADD COLUMN     "pdfLogoSubtext" TEXT NOT NULL DEFAULT 'PEDRO DEV',
ADD COLUMN     "pdfLogoText" TEXT NOT NULL DEFAULT 'PP';
