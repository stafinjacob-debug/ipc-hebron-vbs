-- Horizontal badge layout presets (standard, name+code header, KidCheck-style).
CREATE TYPE "BadgeHorizontalLayout" AS ENUM ('STANDARD', 'NAME_CODE_HEADER', 'KIDCHECK');

ALTER TABLE "BadgePrintSettings" ADD COLUMN "horizontalLayout" "BadgeHorizontalLayout" NOT NULL DEFAULT 'STANDARD';
