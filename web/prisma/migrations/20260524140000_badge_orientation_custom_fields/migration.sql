-- CreateEnum
CREATE TYPE "BadgeOrientation" AS ENUM ('VERTICAL', 'HORIZONTAL');

-- AlterTable
ALTER TABLE "BadgePrintSettings" ADD COLUMN "orientation" "BadgeOrientation" NOT NULL DEFAULT 'VERTICAL';
ALTER TABLE "BadgePrintSettings" ADD COLUMN "customFieldsJson" JSONB NOT NULL DEFAULT '[]';
