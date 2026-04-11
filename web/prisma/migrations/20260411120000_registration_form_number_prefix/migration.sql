-- Per-form registration number template: optional prefix + zero-padded sequence (e.g. IPCHVBS-001).
-- When prefix is null/empty, the app keeps issuing legacy VBS-{year}-{random} codes.

ALTER TABLE "RegistrationForm" ADD COLUMN "registrationNumberPrefix" TEXT;
ALTER TABLE "RegistrationForm" ADD COLUMN "registrationNumberSeqDigits" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE "RegistrationForm" ADD COLUMN "registrationNumberNextSeq" INTEGER NOT NULL DEFAULT 0;
