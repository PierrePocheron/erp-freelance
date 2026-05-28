-- Migration: add CalendarCategory model + GOOGLE source type
-- Applied manually via psql on 2026-05-28

-- 1. Ajouter GOOGLE au type CalendarSourceType (pour la future intégration Google Calendar)
ALTER TYPE "CalendarSourceType" ADD VALUE IF NOT EXISTS 'GOOGLE';

-- 2. Créer la table CalendarCategory
CREATE TABLE IF NOT EXISTS "CalendarCategory" (
  "id"        TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "color"     TEXT NOT NULL,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CalendarCategory_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CalendarCategory_userId_name_key" UNIQUE ("userId", "name"),
  CONSTRAINT "CalendarCategory_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 3. Ajouter categoryId à CalendarEvent
ALTER TABLE "CalendarEvent"
  ADD COLUMN IF NOT EXISTS "categoryId" TEXT;

-- 4. Ajouter la foreign key si elle n'existe pas déjà
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'CalendarEvent_categoryId_fkey'
  ) THEN
    ALTER TABLE "CalendarEvent"
      ADD CONSTRAINT "CalendarEvent_categoryId_fkey"
        FOREIGN KEY ("categoryId") REFERENCES "CalendarCategory"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;
