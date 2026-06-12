-- Check-in block rules (JSON) and optional 4-digit PIN to undo check-in.

ALTER TABLE "VbsSeason" ADD COLUMN "checkInBlockRulesJson" TEXT;
ALTER TABLE "VbsSeason" ADD COLUMN "checkInUndoPin" TEXT;
