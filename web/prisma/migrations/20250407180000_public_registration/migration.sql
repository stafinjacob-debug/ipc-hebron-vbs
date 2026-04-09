-- AlterTable
ALTER TABLE "VbsSeason" ADD COLUMN "publicRegistrationOpen" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "PublicRegistrationSettings" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "requireGuardianEmail" BOOLEAN NOT NULL DEFAULT false,
    "requireGuardianPhone" BOOLEAN NOT NULL DEFAULT false,
    "requireAllergiesNotes" BOOLEAN NOT NULL DEFAULT false,
    "welcomeMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublicRegistrationSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PublicRegistrationSettings_seasonId_key" ON "PublicRegistrationSettings"("seasonId");

-- AddForeignKey
ALTER TABLE "PublicRegistrationSettings" ADD CONSTRAINT "PublicRegistrationSettings_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "VbsSeason"("id") ON DELETE CASCADE ON UPDATE CASCADE;
