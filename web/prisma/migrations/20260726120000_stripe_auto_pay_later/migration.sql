-- AlterTable
ALTER TABLE "RegistrationForm" ADD COLUMN "stripeAutoPayLaterWhenFieldKey" TEXT;
ALTER TABLE "RegistrationForm" ADD COLUMN "stripeAutoPayLaterWhenFieldValues" JSONB;
