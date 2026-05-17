-- Optional "pay later" on public registration when Stripe checkout is enabled.
ALTER TABLE "RegistrationForm" ADD COLUMN "stripePayLaterEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "RegistrationForm" ADD COLUMN "stripePayLaterMessage" TEXT;

ALTER TABLE "FormSubmission" ADD COLUMN "payLaterChosen" BOOLEAN NOT NULL DEFAULT false;
