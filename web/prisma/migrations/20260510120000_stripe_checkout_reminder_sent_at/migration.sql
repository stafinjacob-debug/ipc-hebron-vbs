-- Last time staff emailed a guardian to complete an open Stripe Checkout session.
ALTER TABLE "FormSubmission" ADD COLUMN "stripeCheckoutReminderSentAt" TIMESTAMP(3);
