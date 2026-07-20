-- CreateEnum
CREATE TYPE "ProjectEventKind" AS ENUM ('NOTE', 'MEETING', 'EMAIL', 'CALL', 'PAYMENT', 'DELIVERY', 'LEGAL', 'OTHER');

-- CreateTable
CREATE TABLE "ProjectEvent" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "kind" "ProjectEventKind" NOT NULL DEFAULT 'NOTE',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectEvent_projectId_idx" ON "ProjectEvent"("projectId");

-- AddForeignKey
ALTER TABLE "ProjectEvent" ADD CONSTRAINT "ProjectEvent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

