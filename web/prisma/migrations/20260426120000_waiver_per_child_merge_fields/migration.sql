-- Optional merge + supplemental waiver configuration on the registration form
ALTER TABLE "RegistrationForm" ADD COLUMN "waiverMergeFieldKeys" JSONB;
ALTER TABLE "RegistrationForm" ADD COLUMN "waiverSupplementalFields" JSONB;

-- One signed waiver per child registration (not per family submission)
ALTER TABLE "WaiverAgreement" ADD COLUMN "registrationId" TEXT;
ALTER TABLE "WaiverAgreement" ADD COLUMN "capturedFieldsJson" JSONB;

UPDATE "WaiverAgreement" wa
SET "registrationId" = (
  SELECT r."id"
  FROM "Registration" r
  WHERE r."formSubmissionId" = wa."formSubmissionId"
  ORDER BY r."id" ASC
  LIMIT 1
);

DELETE FROM "WaiverAgreement" WHERE "registrationId" IS NULL;

ALTER TABLE "WaiverAgreement" DROP CONSTRAINT "WaiverAgreement_formSubmissionId_fkey";
DROP INDEX "WaiverAgreement_formSubmissionId_key";

ALTER TABLE "WaiverAgreement" DROP COLUMN "formSubmissionId";

ALTER TABLE "WaiverAgreement" ALTER COLUMN "registrationId" SET NOT NULL;

CREATE UNIQUE INDEX "WaiverAgreement_registrationId_key" ON "WaiverAgreement"("registrationId");

ALTER TABLE "WaiverAgreement"
ADD CONSTRAINT "WaiverAgreement_registrationId_fkey"
FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
