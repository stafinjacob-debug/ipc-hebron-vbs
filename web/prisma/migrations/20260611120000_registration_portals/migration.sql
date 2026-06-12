-- CreateEnum
CREATE TYPE "ProgramKind" AS ENUM ('VBS', 'SPORTS', 'YOUTH', 'GENERAL');

-- AlterTable
ALTER TABLE "VbsSeason" ADD COLUMN "publicRegistrationSlug" TEXT;
ALTER TABLE "VbsSeason" ADD COLUMN "programKind" "ProgramKind" NOT NULL DEFAULT 'VBS';
ALTER TABLE "VbsSeason" ADD COLUMN "participantAgeAsOfDate" TIMESTAMP(3);
ALTER TABLE "VbsSeason" ADD COLUMN "classroomsEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "VbsSeason" ADD COLUMN "checkInEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "VbsSeason" ADD COLUMN "badgesEnabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "PublicRegistrationSettings" ADD COLUMN "publicPageTitle" TEXT;
ALTER TABLE "PublicRegistrationSettings" ADD COLUMN "publicPageDescription" TEXT;
ALTER TABLE "PublicRegistrationSettings" ADD COLUMN "publicHeaderLabel" TEXT;
ALTER TABLE "PublicRegistrationSettings" ADD COLUMN "publicFooterNote" TEXT;
ALTER TABLE "PublicRegistrationSettings" ADD COLUMN "publicLogoUrl" TEXT;
ALTER TABLE "PublicRegistrationSettings" ADD COLUMN "helpContactPhone" TEXT;
ALTER TABLE "PublicRegistrationSettings" ADD COLUMN "contactSectionLabel" TEXT;
ALTER TABLE "PublicRegistrationSettings" ADD COLUMN "participantSectionLabel" TEXT;
ALTER TABLE "PublicRegistrationSettings" ADD COLUMN "participantSingularLabel" TEXT;
ALTER TABLE "PublicRegistrationSettings" ADD COLUMN "sessionPickerLabel" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "VbsSeason_publicRegistrationSlug_key" ON "VbsSeason"("publicRegistrationSlug");
