-- CreateEnum
CREATE TYPE "RegistrationFormStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- AlterEnum: add new registration lifecycle values
ALTER TYPE "RegistrationStatus" ADD VALUE IF NOT EXISTS 'DRAFT';
ALTER TYPE "RegistrationStatus" ADD VALUE IF NOT EXISTS 'CHECKED_OUT';

-- CreateTable
CREATE TABLE "RegistrationForm" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "welcomeMessage" TEXT,
    "instructions" TEXT,
    "confirmationMessage" TEXT,
    "status" "RegistrationFormStatus" NOT NULL DEFAULT 'DRAFT',
    "registrationOpensAt" TIMESTAMP(3),
    "registrationClosesAt" TIMESTAMP(3),
    "maxTotalRegistrations" INTEGER,
    "waitlistEnabled" BOOLEAN NOT NULL DEFAULT false,
    "draftDefinitionJson" TEXT,
    "publishedDefinitionJson" TEXT,
    "publishedAt" TIMESTAMP(3),
    "publishedVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedByUserId" TEXT,

    CONSTRAINT "RegistrationForm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistrationFormAuditLog" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegistrationFormAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormSubmission" (
    "id" TEXT NOT NULL,
    "registrationCode" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "guardianId" TEXT NOT NULL,
    "guardianResponses" JSONB NOT NULL,
    "formVersion" INTEGER NOT NULL DEFAULT 0,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FormSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RegistrationForm_seasonId_key" ON "RegistrationForm"("seasonId");

-- CreateIndex
CREATE INDEX "RegistrationFormAuditLog_formId_idx" ON "RegistrationFormAuditLog"("formId");

-- CreateIndex
CREATE UNIQUE INDEX "FormSubmission_registrationCode_key" ON "FormSubmission"("registrationCode");

-- CreateIndex
CREATE INDEX "FormSubmission_seasonId_idx" ON "FormSubmission"("seasonId");

-- CreateIndex
CREATE INDEX "FormSubmission_registrationCode_idx" ON "FormSubmission"("registrationCode");

-- AddForeignKey
ALTER TABLE "RegistrationForm" ADD CONSTRAINT "RegistrationForm_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "VbsSeason"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrationFormAuditLog" ADD CONSTRAINT "RegistrationFormAuditLog_formId_fkey" FOREIGN KEY ("formId") REFERENCES "RegistrationForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormSubmission" ADD CONSTRAINT "FormSubmission_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "VbsSeason"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormSubmission" ADD CONSTRAINT "FormSubmission_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "Guardian"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable Registration
ALTER TABLE "Registration" ADD COLUMN "formSubmissionId" TEXT,
ADD COLUMN "customResponses" JSONB;

CREATE INDEX "Registration_formSubmissionId_idx" ON "Registration"("formSubmissionId");

ALTER TABLE "Registration" ADD CONSTRAINT "Registration_formSubmissionId_fkey" FOREIGN KEY ("formSubmissionId") REFERENCES "FormSubmission"("id") ON DELETE SET NULL ON UPDATE CASCADE;
