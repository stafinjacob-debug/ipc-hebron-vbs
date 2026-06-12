-- Allow registration to stay open via direct link while hiding a program from the login landing card list.
ALTER TABLE "VbsSeason" ADD COLUMN "showOnPublicLanding" BOOLEAN NOT NULL DEFAULT true;
