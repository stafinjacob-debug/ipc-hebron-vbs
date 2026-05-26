-- Allow admins to hide the public "look up registration" link on each form (enabled by default).
ALTER TABLE "RegistrationForm" ADD COLUMN "registrantLookupEnabled" BOOLEAN NOT NULL DEFAULT true;
