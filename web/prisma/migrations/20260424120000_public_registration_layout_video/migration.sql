-- CreateEnum
CREATE TYPE "PublicRegistrationLayout" AS ENUM ('OVERLAY', 'SPLIT_FORM_LEFT', 'SPLIT_FORM_RIGHT');

-- AlterTable
ALTER TABLE "PublicRegistrationSettings"
  ADD COLUMN "registrationBackgroundVideoUrl" TEXT,
  ADD COLUMN "registrationBackgroundLayout" "PublicRegistrationLayout" NOT NULL DEFAULT 'OVERLAY';
