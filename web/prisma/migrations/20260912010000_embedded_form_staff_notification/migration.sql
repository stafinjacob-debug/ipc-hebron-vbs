-- AlterTable
ALTER TABLE "EmbeddedForm" ADD COLUMN "notificationEmail" TEXT;

-- AlterTable
ALTER TABLE "EmbeddedFormSubmission" ADD COLUMN "staffNotificationEmailSentAt" TIMESTAMP(3);
ALTER TABLE "EmbeddedFormSubmission" ADD COLUMN "stripePaymentIntentId" TEXT;
