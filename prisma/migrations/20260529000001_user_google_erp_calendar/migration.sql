-- Identifiant de l'agenda Google dédié "ERP Freelance" (créé à la volée).
-- Permet de pousser les événements ERP dans un agenda séparé (couleur de base
-- + case à cocher d'affichage native côté Google).
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "googleErpCalendarId" TEXT;
