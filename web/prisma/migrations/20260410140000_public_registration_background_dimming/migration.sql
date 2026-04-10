-- Darkening layer over the /register background photo (0 = none, 100 = max). Default matches prior ~60% scrim.
ALTER TABLE "PublicRegistrationSettings" ADD COLUMN "registrationBackgroundDimmingPercent" INTEGER NOT NULL DEFAULT 60;
