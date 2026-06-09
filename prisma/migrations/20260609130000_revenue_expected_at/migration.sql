-- Date prévisionnelle de réception d'un revenu en attente
ALTER TABLE "Revenue"
  ADD COLUMN IF NOT EXISTS "expectedAt" TIMESTAMP(3);
