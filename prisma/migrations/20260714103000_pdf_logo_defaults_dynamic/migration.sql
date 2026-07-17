-- Le logo texte et le sous-titre deviennent optionnels : null = défauts
-- dynamiques (initiales de l'utilisateur / raison sociale) résolus au rendu.
ALTER TABLE "UserProfile" ALTER COLUMN "pdfLogoText" DROP NOT NULL;
ALTER TABLE "UserProfile" ALTER COLUMN "pdfLogoText" DROP DEFAULT;
ALTER TABLE "UserProfile" ALTER COLUMN "pdfLogoSubtext" DROP NOT NULL;
ALTER TABLE "UserProfile" ALTER COLUMN "pdfLogoSubtext" DROP DEFAULT;
