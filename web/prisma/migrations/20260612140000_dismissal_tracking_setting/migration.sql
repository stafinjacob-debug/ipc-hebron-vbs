-- Optional Arrivals / Dismissal modes on the check-in desk (mobile app).
ALTER TABLE "VbsSeason" ADD COLUMN "dismissalTrackingEnabled" BOOLEAN NOT NULL DEFAULT false;
