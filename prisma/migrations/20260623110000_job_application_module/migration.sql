-- Module Entretiens : JobApplication + JobApplicationEvent

CREATE TYPE "JobApplicationStatus" AS ENUM ('WISHLIST', 'APPLIED', 'SCREENING', 'INTERVIEW', 'TECHNICAL', 'FINAL', 'OFFER', 'ACCEPTED', 'REJECTED', 'WITHDRAWN', 'GHOSTED');
CREATE TYPE "JobEventType" AS ENUM ('APPLICATION', 'CALL', 'VIDEO', 'ONSITE', 'EMAIL', 'MESSAGE', 'TECHNICAL_TEST', 'OFFER', 'OTHER');

CREATE TABLE "JobApplication" (
    "id"              TEXT NOT NULL,
    "userId"          TEXT NOT NULL,
    "companyName"     TEXT NOT NULL,
    "companyId"       TEXT,
    "position"        TEXT NOT NULL,
    "location"        TEXT,
    "workMode"        TEXT,
    "status"          "JobApplicationStatus" NOT NULL DEFAULT 'WISHLIST',
    "source"          TEXT,
    "url"             TEXT,
    "salaryMin"       DOUBLE PRECISION,
    "salaryMax"       DOUBLE PRECISION,
    "salaryNote"      TEXT,
    "notes"           TEXT,
    "priority"        INTEGER NOT NULL DEFAULT 1,
    "contactId"       TEXT,
    "appliedAt"       TIMESTAMP(3),
    "nextActionAt"    TIMESTAMP(3),
    "nextActionLabel" TEXT,
    "closedAt"        TIMESTAMP(3),
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,
    CONSTRAINT "JobApplication_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "JobApplicationEvent" (
    "id"            TEXT NOT NULL,
    "userId"        TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "date"          TIMESTAMP(3) NOT NULL,
    "type"          "JobEventType" NOT NULL DEFAULT 'OTHER',
    "title"         TEXT NOT NULL,
    "notes"         TEXT,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "JobApplicationEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "JobApplication_userId_idx" ON "JobApplication"("userId");
CREATE INDEX "JobApplication_companyId_idx" ON "JobApplication"("companyId");
CREATE INDEX "JobApplication_contactId_idx" ON "JobApplication"("contactId");
CREATE INDEX "JobApplicationEvent_userId_idx" ON "JobApplicationEvent"("userId");
CREATE INDEX "JobApplicationEvent_applicationId_idx" ON "JobApplicationEvent"("applicationId");

ALTER TABLE "JobApplication" ADD CONSTRAINT "JobApplication_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JobApplication" ADD CONSTRAINT "JobApplication_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "JobApplication" ADD CONSTRAINT "JobApplication_contactId_fkey"
    FOREIGN KEY ("contactId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "JobApplicationEvent" ADD CONSTRAINT "JobApplicationEvent_applicationId_fkey"
    FOREIGN KEY ("applicationId") REFERENCES "JobApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
