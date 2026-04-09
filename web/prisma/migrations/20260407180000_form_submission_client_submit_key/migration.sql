-- AlterTable
ALTER TABLE "FormSubmission" ADD COLUMN "clientSubmitKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "FormSubmission_clientSubmitKey_seasonId_key" ON "FormSubmission"("clientSubmitKey", "seasonId");
