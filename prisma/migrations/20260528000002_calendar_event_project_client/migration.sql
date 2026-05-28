-- Ajout des liens projet / client sur CalendarEvent
ALTER TABLE "CalendarEvent" ADD COLUMN IF NOT EXISTS "projectId" TEXT;
ALTER TABLE "CalendarEvent" ADD COLUMN IF NOT EXISTS "clientId"  TEXT;
