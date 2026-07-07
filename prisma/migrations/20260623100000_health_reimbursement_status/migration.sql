-- Remboursements santé : suivi PENDING / RECEIVED (modèle aligné sur Revenue)

CREATE TYPE "ReimbursementStatus" AS ENUM ('PENDING', 'RECEIVED');

ALTER TABLE "HealthReimbursement" ADD COLUMN "status" "ReimbursementStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "HealthReimbursement" ADD COLUMN "expectedDate" TIMESTAMP(3);
ALTER TABLE "HealthReimbursement" ADD COLUMN "receivedAt" TIMESTAMP(3);

-- Les enregistrements existants représentaient un remboursement déjà reçu :
-- on les marque RECEIVED et on reporte leur date dans receivedAt.
UPDATE "HealthReimbursement" SET "status" = 'RECEIVED', "receivedAt" = "date";

-- La colonne date générique est remplacée par expectedDate / receivedAt.
ALTER TABLE "HealthReimbursement" DROP COLUMN "date";
