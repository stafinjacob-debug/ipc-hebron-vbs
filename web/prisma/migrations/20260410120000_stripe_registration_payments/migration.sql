-- CreateEnum
CREATE TYPE "StripePricingUnit" AS ENUM ('PER_SUBMISSION', 'PER_CHILD');

-- CreateEnum
CREATE TYPE "StripeProcessingFeeMode" AS ENUM ('OPTIONAL', 'REQUIRED');

-- AlterTable
ALTER TABLE "RegistrationForm" ADD COLUMN     "stripeCheckoutEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "stripeAmountCents" INTEGER,
ADD COLUMN     "stripePricingUnit" "StripePricingUnit" NOT NULL DEFAULT 'PER_SUBMISSION',
ADD COLUMN     "stripeProcessingFeeMode" "StripeProcessingFeeMode" NOT NULL DEFAULT 'OPTIONAL',
ADD COLUMN     "stripeProductLabel" TEXT;

-- AlterTable
ALTER TABLE "FormSubmission" ADD COLUMN     "stripeCheckoutSessionId" TEXT,
ADD COLUMN     "stripePaymentStatus" TEXT,
ADD COLUMN     "stripePaidAt" TIMESTAMP(3),
ADD COLUMN     "stripeAmountChargedCents" INTEGER,
ADD COLUMN     "stripeCoverProcessingFee" BOOLEAN;

-- CreateIndex
CREATE UNIQUE INDEX "FormSubmission_stripeCheckoutSessionId_key" ON "FormSubmission"("stripeCheckoutSessionId");
