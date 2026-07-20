-- CreateEnum
CREATE TYPE "ProspectEventKind" AS ENUM ('CALL_ANSWERED', 'CALL_NO_ANSWER', 'EMAIL_SENT', 'REPLY_POSITIVE', 'REPLY_NEGATIVE', 'MEETING_BOOKED', 'STATUS_CHANGE');

-- CreateTable
CREATE TABLE "ProspectEvent" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "kind" "ProspectEventKind" NOT NULL,
    "fromStatus" "ProspectStatus",
    "toStatus" "ProspectStatus",
    "note" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProspectEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProspectNote" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProspectNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProspectEvent_clientId_idx" ON "ProspectEvent"("clientId");

-- CreateIndex
CREATE INDEX "ProspectNote_clientId_idx" ON "ProspectNote"("clientId");

-- AddForeignKey
ALTER TABLE "ProspectEvent" ADD CONSTRAINT "ProspectEvent_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProspectNote" ADD CONSTRAINT "ProspectNote_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

