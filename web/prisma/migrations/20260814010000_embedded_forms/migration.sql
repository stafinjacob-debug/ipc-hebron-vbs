-- CreateEnum
CREATE TYPE "EmbeddedFormStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "EmbeddedSubmissionStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED', 'REFERRED');

-- CreateTable
CREATE TABLE "EmbeddedForm" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "slug" TEXT NOT NULL,
    "status" "EmbeddedFormStatus" NOT NULL DEFAULT 'DRAFT',
    "welcomeMessage" TEXT,
    "confirmationMessage" TEXT,
    "instructions" TEXT,
    "emailFromName" TEXT,
    "emailSubject" TEXT,
    "helpEmail" TEXT,
    "helpPhone" TEXT,
    "draftDefinitionJson" TEXT,
    "publishedDefinitionJson" TEXT,
    "publishedAt" TIMESTAMP(3),
    "publishedVersion" INTEGER NOT NULL DEFAULT 0,
    "pdfTemplateKey" TEXT,
    "applicationNumberPrefix" TEXT,
    "applicationNumberSeqDigits" INTEGER NOT NULL DEFAULT 3,
    "applicationNumberNextSeq" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmbeddedForm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmbeddedFormAuditLog" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmbeddedFormAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmbeddedFormSubmission" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "applicationNumber" TEXT NOT NULL,
    "clientSubmitKey" TEXT,
    "formVersion" INTEGER NOT NULL DEFAULT 0,
    "status" "EmbeddedSubmissionStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "applicantFullName" TEXT NOT NULL,
    "applicantEmail" TEXT NOT NULL,
    "applicantPhone" TEXT,
    "responsesJson" JSONB NOT NULL,
    "definitionSnapshotJson" TEXT NOT NULL,
    "photoObjectKey" TEXT,
    "photoContentType" TEXT,
    "signatureTypedName" TEXT,
    "signedAt" TIMESTAMP(3),
    "declarationAccepted" BOOLEAN NOT NULL DEFAULT false,
    "registrarResponsesJson" JSONB,
    "receivedAt" TIMESTAMP(3),
    "applicationReceivedEmailSentAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "reviewedByUserId" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmbeddedFormSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmbeddedForm_slug_key" ON "EmbeddedForm"("slug");

-- CreateIndex
CREATE INDEX "EmbeddedFormAuditLog_formId_createdAt_idx" ON "EmbeddedFormAuditLog"("formId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmbeddedFormSubmission_applicationNumber_key" ON "EmbeddedFormSubmission"("applicationNumber");

-- CreateIndex
CREATE INDEX "EmbeddedFormSubmission_formId_submittedAt_idx" ON "EmbeddedFormSubmission"("formId", "submittedAt");

-- CreateIndex
CREATE INDEX "EmbeddedFormSubmission_applicantEmail_idx" ON "EmbeddedFormSubmission"("applicantEmail");

-- CreateIndex
CREATE INDEX "EmbeddedFormSubmission_status_idx" ON "EmbeddedFormSubmission"("status");

-- CreateIndex
CREATE UNIQUE INDEX "EmbeddedFormSubmission_formId_clientSubmitKey_key" ON "EmbeddedFormSubmission"("formId", "clientSubmitKey");

-- AddForeignKey
ALTER TABLE "EmbeddedFormAuditLog" ADD CONSTRAINT "EmbeddedFormAuditLog_formId_fkey" FOREIGN KEY ("formId") REFERENCES "EmbeddedForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmbeddedFormSubmission" ADD CONSTRAINT "EmbeddedFormSubmission_formId_fkey" FOREIGN KEY ("formId") REFERENCES "EmbeddedForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
