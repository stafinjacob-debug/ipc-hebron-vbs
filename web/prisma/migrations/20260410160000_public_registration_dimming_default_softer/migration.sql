-- Softer default for new rows; existing values unchanged (rendering curve was adjusted in app).
ALTER TABLE "PublicRegistrationSettings" ALTER COLUMN "registrationBackgroundDimmingPercent" SET DEFAULT 48;
