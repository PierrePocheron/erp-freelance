-- Synchronisation ERP → Google : mémorise l'ID de l'événement Google poussé
-- et la date de dernière synchro (pour l'arbitrage "dernière modif gagne").
ALTER TABLE "CalendarEvent" ADD COLUMN IF NOT EXISTS "googleEventId"  TEXT;
ALTER TABLE "CalendarEvent" ADD COLUMN IF NOT EXISTS "googleSyncedAt" TIMESTAMP(3);
