-- AlterTable
ALTER TABLE "EmbeddedForm" ADD COLUMN "stripeCheckoutEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "EmbeddedForm" ADD COLUMN "stripeAmountCents" INTEGER;
ALTER TABLE "EmbeddedForm" ADD COLUMN "stripeProductLabel" TEXT;
ALTER TABLE "EmbeddedForm" ADD COLUMN "stripeIncludeProcessingFee" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "EmbeddedFormSubmission" ADD COLUMN "academicDocumentKeys" JSONB;
ALTER TABLE "EmbeddedFormSubmission" ADD COLUMN "stripeCheckoutSessionId" TEXT;
ALTER TABLE "EmbeddedFormSubmission" ADD COLUMN "stripePaymentStatus" TEXT;
ALTER TABLE "EmbeddedFormSubmission" ADD COLUMN "stripePaidAt" TIMESTAMP(3);
ALTER TABLE "EmbeddedFormSubmission" ADD COLUMN "stripeAmountChargedCents" INTEGER;
ALTER TABLE "EmbeddedFormSubmission" ADD COLUMN "stripeBaseCents" INTEGER;
ALTER TABLE "EmbeddedFormSubmission" ADD COLUMN "stripeProcessingCents" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "EmbeddedFormSubmission_stripeCheckoutSessionId_key" ON "EmbeddedFormSubmission"("stripeCheckoutSessionId");
