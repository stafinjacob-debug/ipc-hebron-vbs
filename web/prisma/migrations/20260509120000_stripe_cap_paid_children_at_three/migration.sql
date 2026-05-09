-- Per-child Stripe billing: optional cap at three paid slots per submission (fourth+ free).
ALTER TABLE "RegistrationForm" ADD COLUMN "stripeCapPaidChildrenAtThree" BOOLEAN NOT NULL DEFAULT false;
