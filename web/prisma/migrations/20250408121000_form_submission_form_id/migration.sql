-- Link submissions to the season's registration form (optional for legacy rows).
ALTER TABLE "FormSubmission" ADD COLUMN "formId" TEXT;

CREATE INDEX "FormSubmission_formId_idx" ON "FormSubmission"("formId");

ALTER TABLE "FormSubmission" ADD CONSTRAINT "FormSubmission_formId_fkey" FOREIGN KEY ("formId") REFERENCES "RegistrationForm"("id") ON DELETE SET NULL ON UPDATE CASCADE;
