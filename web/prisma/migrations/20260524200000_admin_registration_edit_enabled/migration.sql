-- Allow staff with directory access to edit registration form entries from the admin console.
ALTER TABLE "RegistrationForm" ADD COLUMN "adminRegistrationEditEnabled" BOOLEAN NOT NULL DEFAULT true;
