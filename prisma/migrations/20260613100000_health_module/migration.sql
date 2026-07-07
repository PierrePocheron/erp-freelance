-- Module Santé : HealthEvent, HealthConsultation, HealthReimbursement

CREATE TYPE "HealthEventType" AS ENUM ('INJURY', 'ILLNESS', 'OTHER');
CREATE TYPE "PractitionerType" AS ENUM ('GENERAL', 'OSTEOPATH', 'SPECIALIST', 'SOS_MEDECIN', 'NURSE', 'PHYSIO', 'DENTIST', 'OTHER');
CREATE TYPE "ReimbursementSource" AS ENUM ('SECU', 'MUTUELLE');

CREATE TABLE "HealthEvent" (
    "id"          TEXT NOT NULL,
    "userId"      TEXT NOT NULL,
    "date"        TIMESTAMP(3) NOT NULL,
    "type"        "HealthEventType" NOT NULL,
    "title"       TEXT NOT NULL,
    "description" TEXT,
    "bodyPart"    TEXT,
    "resolvedAt"  TIMESTAMP(3),
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    CONSTRAINT "HealthEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HealthConsultation" (
    "id"               TEXT NOT NULL,
    "userId"           TEXT NOT NULL,
    "date"             TIMESTAMP(3) NOT NULL,
    "practitionerName" TEXT NOT NULL,
    "practitionerType" "PractitionerType" NOT NULL DEFAULT 'OTHER',
    "title"            TEXT NOT NULL,
    "notes"            TEXT,
    "cost"             DOUBLE PRECISION,
    "hasDocument"      BOOLEAN NOT NULL DEFAULT false,
    "documentRef"      TEXT,
    "healthEventId"    TEXT,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL,
    CONSTRAINT "HealthConsultation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HealthReimbursement" (
    "id"             TEXT NOT NULL,
    "userId"         TEXT NOT NULL,
    "date"           TIMESTAMP(3) NOT NULL,
    "amount"         DOUBLE PRECISION NOT NULL,
    "source"         "ReimbursementSource" NOT NULL,
    "notes"          TEXT,
    "consultationId" TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,
    CONSTRAINT "HealthReimbursement_pkey" PRIMARY KEY ("id")
);

-- Index
CREATE INDEX "HealthEvent_userId_idx" ON "HealthEvent"("userId");
CREATE INDEX "HealthConsultation_userId_idx" ON "HealthConsultation"("userId");
CREATE INDEX "HealthConsultation_healthEventId_idx" ON "HealthConsultation"("healthEventId");
CREATE INDEX "HealthReimbursement_userId_idx" ON "HealthReimbursement"("userId");
CREATE INDEX "HealthReimbursement_consultationId_idx" ON "HealthReimbursement"("consultationId");

-- Foreign keys
ALTER TABLE "HealthEvent" ADD CONSTRAINT "HealthEvent_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HealthConsultation" ADD CONSTRAINT "HealthConsultation_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HealthConsultation" ADD CONSTRAINT "HealthConsultation_healthEventId_fkey"
    FOREIGN KEY ("healthEventId") REFERENCES "HealthEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "HealthReimbursement" ADD CONSTRAINT "HealthReimbursement_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HealthReimbursement" ADD CONSTRAINT "HealthReimbursement_consultationId_fkey"
    FOREIGN KEY ("consultationId") REFERENCES "HealthConsultation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
