-- InvestmentPlatform.type : enum InvestmentType → chaîne libre (types personnalisés).
-- Conversion NON destructive : on caste l'enum en texte (USING) pour CONSERVER les
-- valeurs existantes (CROWDLENDING, IMMOBILIER, PEA, …). Le type Postgres "InvestmentType"
-- n'est pas supprimé (réversibilité + documenté dans schema.prisma).
ALTER TABLE "InvestmentPlatform" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE "InvestmentPlatform" ALTER COLUMN "type" TYPE TEXT USING "type"::text;
ALTER TABLE "InvestmentPlatform" ALTER COLUMN "type" SET DEFAULT 'CROWDLENDING';
