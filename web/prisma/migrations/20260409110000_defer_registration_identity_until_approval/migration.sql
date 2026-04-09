-- Allow registration identity fields to be assigned at approval time.
ALTER TABLE "Registration" ALTER COLUMN "registrationNumber" DROP NOT NULL;
ALTER TABLE "Registration" ALTER COLUMN "checkInToken" DROP NOT NULL;
