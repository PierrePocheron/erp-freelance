-- CreateTable
CREATE TABLE "CallTemplate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "script" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CallTemplate_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "CallTemplate_userId_idx" ON "CallTemplate"("userId");
-- AddForeignKey
ALTER TABLE "CallTemplate" ADD CONSTRAINT "CallTemplate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
