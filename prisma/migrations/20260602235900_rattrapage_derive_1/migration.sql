-- Rattrapage de dérive (#9) : colonnes créées en production par `prisma db push`, jamais décrites
-- dans une migration. Sans elles, une base reconstruite depuis les migrations échouait à la
-- migration suivante. IDEMPOTENT (IF NOT EXISTS) : sans effet sur la production, où tout existe.
ALTER TABLE "UserProfile" ADD COLUMN IF NOT EXISTS "customAccentColors" TEXT;
