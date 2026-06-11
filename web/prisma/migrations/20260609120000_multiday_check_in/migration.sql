-- Multi-day check-in: season toggle + per-day attendance records.

ALTER TABLE "VbsSeason" ADD COLUMN "multiDayCheckInEnabled" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "RegistrationAttendanceDay" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "registrationId" TEXT NOT NULL,
    "campDate" TIMESTAMP(3) NOT NULL,
    "checkedInAt" TIMESTAMP(3),
    "checkedOutAt" TIMESTAMP(3),

    CONSTRAINT "RegistrationAttendanceDay_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RegistrationAttendanceDay_registrationId_campDate_key" ON "RegistrationAttendanceDay"("registrationId", "campDate");
CREATE INDEX "RegistrationAttendanceDay_campDate_idx" ON "RegistrationAttendanceDay"("campDate");
CREATE INDEX "RegistrationAttendanceDay_registrationId_idx" ON "RegistrationAttendanceDay"("registrationId");

ALTER TABLE "RegistrationAttendanceDay" ADD CONSTRAINT "RegistrationAttendanceDay_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill one attendance row per registration that already has checkedInAt.
INSERT INTO "RegistrationAttendanceDay" ("id", "updatedAt", "registrationId", "campDate", "checkedInAt")
SELECT
    concat('migrated-', r."id", '-', to_char((r."checkedInAt" AT TIME ZONE 'UTC')::date, 'YYYYMMDD')),
    NOW(),
    r."id",
    ((r."checkedInAt" AT TIME ZONE 'UTC')::date::timestamp AT TIME ZONE 'UTC'),
    r."checkedInAt"
FROM "Registration" r
WHERE r."checkedInAt" IS NOT NULL
ON CONFLICT ("registrationId", "campDate") DO NOTHING;
