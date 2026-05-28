-- Map public registration lookup to specific form fields per season.
ALTER TABLE "RegistrationForm"
ADD COLUMN "registrantLookupEmailFieldKey" TEXT,
ADD COLUMN "registrantLookupPhoneFieldKey" TEXT;
