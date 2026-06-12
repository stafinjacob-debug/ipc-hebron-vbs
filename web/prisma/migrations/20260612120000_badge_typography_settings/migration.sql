-- Per-season badge font sizes and line spacing (Brother / KidCheck horizontal layout).
ALTER TABLE "BadgePrintSettings" ADD COLUMN "typographyJson" JSONB NOT NULL DEFAULT '{}';
