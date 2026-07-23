-- CreateTable
CREATE TABLE "_AnswerApplications" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_AnswerApplications_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_AnswerApplications_B_index" ON "_AnswerApplications"("B");

-- AddForeignKey
ALTER TABLE "_AnswerApplications" ADD CONSTRAINT "_AnswerApplications_A_fkey" FOREIGN KEY ("A") REFERENCES "InterviewAnswer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AnswerApplications" ADD CONSTRAINT "_AnswerApplications_B_fkey" FOREIGN KEY ("B") REFERENCES "JobApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
