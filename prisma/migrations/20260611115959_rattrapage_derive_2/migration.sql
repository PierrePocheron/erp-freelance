-- Rattrapage de dérive (#9) : objets créés en production par `prisma db push`, jamais décrits
-- dans une migration. Sans eux, une base reconstruite depuis les migrations échouait à la
-- migration suivante. IDEMPOTENT (IF NOT EXISTS / exceptions ignorées) : sans effet sur la
-- production, où tout existe déjà. Généré depuis le schéma, colonnes/index/valeurs d'enum
-- ajoutés par les migrations suivantes exclus.

DO $$ BEGIN CREATE TYPE "FiscalBucket" AS ENUM ('AE_URSSAF', 'NON_IMPOSABLE', 'OTHER'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "FiscalSource" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bucket" "FiscalBucket" NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FiscalSource_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "FiscalSource_userId_idx" ON "FiscalSource"("userId");

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FiscalSource_userId_fkey') THEN ALTER TABLE "FiscalSource" ADD CONSTRAINT "FiscalSource_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;
