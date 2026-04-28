-- Optional JSON string[] of form field keys to show in "Add unassigned" class dropdown (staff).
ALTER TABLE "RegistrationForm" ADD COLUMN IF NOT EXISTS "unassignedClassPickerFieldKeys" JSONB;
