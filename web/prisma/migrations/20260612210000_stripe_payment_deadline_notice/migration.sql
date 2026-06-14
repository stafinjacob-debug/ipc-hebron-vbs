-- Optional admin override for the payment deadline notice (pay-later thank-you, lookup pay, emails).

ALTER TABLE "RegistrationForm" ADD COLUMN "stripePaymentDeadlineNotice" TEXT;
