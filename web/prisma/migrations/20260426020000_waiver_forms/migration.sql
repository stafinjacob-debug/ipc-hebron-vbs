ALTER TABLE "RegistrationForm"
ADD COLUMN "waiverEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "waiverTitle" TEXT,
ADD COLUMN "waiverBody" TEXT;

CREATE TABLE "WaiverAgreement" (
  "id" TEXT NOT NULL,
  "formSubmissionId" TEXT NOT NULL,
  "seasonId" TEXT NOT NULL,
  "signerName" TEXT NOT NULL,
  "signedAt" TIMESTAMP(3) NOT NULL,
  "signatureDataUrl" TEXT NOT NULL,
  "pdfUrl" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WaiverAgreement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WaiverAgreement_formSubmissionId_key" ON "WaiverAgreement"("formSubmissionId");
CREATE INDEX "WaiverAgreement_seasonId_createdAt_idx" ON "WaiverAgreement"("seasonId", "createdAt");

ALTER TABLE "WaiverAgreement"
ADD CONSTRAINT "WaiverAgreement_formSubmissionId_fkey"
FOREIGN KEY ("formSubmissionId") REFERENCES "FormSubmission"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WaiverAgreement"
ADD CONSTRAINT "WaiverAgreement_seasonId_fkey"
FOREIGN KEY ("seasonId") REFERENCES "VbsSeason"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
