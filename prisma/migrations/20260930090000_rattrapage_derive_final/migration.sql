-- Rattrapage de dérive FINAL (#9) : ce que `prisma db push` avait créé en production sans aucune
-- migration (TaskTag, ProjectMember, table de liaison des étiquettes, colonnes, valeurs d'enum,
-- clés étrangères). Avec les rattrapages intermédiaires, une base reconstruite depuis
-- prisma/migrations est désormais identique au schéma (migrate diff vide).
-- IDEMPOTENT : sur la production, où tout existe déjà, chaque instruction est sans effet.

-- Enums
DO $$ BEGIN CREATE TYPE "ProjectMemberRole" AS ENUM ('ADMIN', 'MEMBER', 'VIEWER'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TYPE "ClientType" ADD VALUE IF NOT EXISTS 'TO_COMPLETE';
ALTER TYPE "ClientType" ADD VALUE IF NOT EXISTS 'PERSONAL';

-- Colonnes
ALTER TABLE "EmitterProfile" ADD COLUMN IF NOT EXISTS "fiscalSourceId" TEXT;
ALTER TABLE "JournalEntry" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "JournalEntry" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "RecurringRevenue" ADD COLUMN IF NOT EXISTS "fiscalSourceId" TEXT;
ALTER TABLE "RecurringRevenue" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "Revenue" ADD COLUMN IF NOT EXISTS "fiscalSourceId" TEXT;
ALTER TABLE "Revenue" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "clientId" TEXT;
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "color" TEXT;
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "importance" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "isGroup" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Task" ALTER COLUMN "projectId" DROP NOT NULL;
ALTER TABLE "Task" ALTER COLUMN "priority" SET DEFAULT 'LOW';
ALTER TABLE "UserProfile" ADD COLUMN IF NOT EXISTS "invoiceNumberFormat" TEXT NOT NULL DEFAULT 'PREFIX-YYYY-NNN';
ALTER TABLE "UserProfile" ADD COLUMN IF NOT EXISTS "quoteNumberFormat" TEXT NOT NULL DEFAULT 'PREFIX-YYYY-NNN';

-- Tables
CREATE TABLE IF NOT EXISTS "ProjectMember" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "ProjectMemberRole" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectMember_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "TaskTag" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaskTag_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "_TaskToTaskTag" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_TaskToTaskTag_AB_pkey" PRIMARY KEY ("A","B")
);

-- Index
CREATE UNIQUE INDEX IF NOT EXISTS "ProjectMember_projectId_userId_key" ON "ProjectMember"("projectId", "userId");
CREATE UNIQUE INDEX IF NOT EXISTS "TaskTag_projectId_name_key" ON "TaskTag"("projectId", "name");
CREATE INDEX IF NOT EXISTS "_TaskToTaskTag_B_index" ON "_TaskToTaskTag"("B");
CREATE INDEX IF NOT EXISTS "EmitterProfile_fiscalSourceId_idx" ON "EmitterProfile"("fiscalSourceId");
CREATE INDEX IF NOT EXISTS "RecurringRevenue_fiscalSourceId_idx" ON "RecurringRevenue"("fiscalSourceId");
CREATE INDEX IF NOT EXISTS "Revenue_fiscalSourceId_idx" ON "Revenue"("fiscalSourceId");

-- Clé Project → Client : ON DELETE SET NULL (les migrations la créaient autrement). Recréée
-- seulement si la règle diffère — en production elle est déjà en SET NULL, rien ne bouge.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Project_clientId_fkey' AND confdeltype <> 'n') THEN
    ALTER TABLE "Project" DROP CONSTRAINT "Project_clientId_fkey";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Project_clientId_fkey') THEN
    ALTER TABLE "Project" ADD CONSTRAINT "Project_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Clés étrangères
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EmitterProfile_fiscalSourceId_fkey') THEN ALTER TABLE "EmitterProfile" ADD CONSTRAINT "EmitterProfile_fiscalSourceId_fkey" FOREIGN KEY ("fiscalSourceId") REFERENCES "FiscalSource"("id") ON DELETE SET NULL ON UPDATE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProjectMember_projectId_fkey') THEN ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProjectMember_userId_fkey') THEN ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Task_userId_fkey') THEN ALTER TABLE "Task" ADD CONSTRAINT "Task_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Task_clientId_fkey') THEN ALTER TABLE "Task" ADD CONSTRAINT "Task_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TaskTag_projectId_fkey') THEN ALTER TABLE "TaskTag" ADD CONSTRAINT "TaskTag_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Revenue_fiscalSourceId_fkey') THEN ALTER TABLE "Revenue" ADD CONSTRAINT "Revenue_fiscalSourceId_fkey" FOREIGN KEY ("fiscalSourceId") REFERENCES "FiscalSource"("id") ON DELETE SET NULL ON UPDATE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RecurringRevenue_fiscalSourceId_fkey') THEN ALTER TABLE "RecurringRevenue" ADD CONSTRAINT "RecurringRevenue_fiscalSourceId_fkey" FOREIGN KEY ("fiscalSourceId") REFERENCES "FiscalSource"("id") ON DELETE SET NULL ON UPDATE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '_TaskToTaskTag_A_fkey') THEN ALTER TABLE "_TaskToTaskTag" ADD CONSTRAINT "_TaskToTaskTag_A_fkey" FOREIGN KEY ("A") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '_TaskToTaskTag_B_fkey') THEN ALTER TABLE "_TaskToTaskTag" ADD CONSTRAINT "_TaskToTaskTag_B_fkey" FOREIGN KEY ("B") REFERENCES "TaskTag"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;
