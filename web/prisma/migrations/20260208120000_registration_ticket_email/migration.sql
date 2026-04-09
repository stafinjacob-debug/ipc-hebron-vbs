-- Registration ticket / QR / email tracking
-- Idempotent: safe if a previous attempt added columns before failing (e.g. gen_random_bytes without pgcrypto).
ALTER TABLE "Registration" ADD COLUMN IF NOT EXISTS "registrationNumber" TEXT;
ALTER TABLE "Registration" ADD COLUMN IF NOT EXISTS "checkInToken" TEXT;
ALTER TABLE "Registration" ADD COLUMN IF NOT EXISTS "expectsPayment" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Registration" ADD COLUMN IF NOT EXISTS "paymentReceivedAt" TIMESTAMP(3);
ALTER TABLE "Registration" ADD COLUMN IF NOT EXISTS "paymentReminderSentAt" TIMESTAMP(3);
ALTER TABLE "Registration" ADD COLUMN IF NOT EXISTS "confirmationEmailSentAt" TIMESTAMP(3);
ALTER TABLE "Registration" ADD COLUMN IF NOT EXISTS "submissionReceivedEmailSentAt" TIMESTAMP(3);

-- Avoid gen_random_bytes (requires pgcrypto; often unavailable on Azure PostgreSQL)
UPDATE "Registration" r
SET
  "checkInToken" = md5(random()::text || r.id::text || clock_timestamp()::text)
    || md5(r.id::text || random()::text || clock_timestamp()::text || random()::text),
  "registrationNumber" = 'VBS-' || s.year::text || '-' || upper(substr(md5(r.id || clock_timestamp()::text || random()::text), 1, 8))
FROM "VbsSeason" s
WHERE r."seasonId" = s.id
  AND (r."checkInToken" IS NULL OR r."registrationNumber" IS NULL);

ALTER TABLE "Registration" ALTER COLUMN "registrationNumber" SET NOT NULL;
ALTER TABLE "Registration" ALTER COLUMN "checkInToken" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "Registration_registrationNumber_key" ON "Registration"("registrationNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "Registration_checkInToken_key" ON "Registration"("checkInToken");
