-- CreateEnum
CREATE TYPE "BadgeLabelSize" AS ENUM ('LABEL_2X3', 'LABEL_4X6', 'LABEL_62MM');

-- CreateTable
CREATE TABLE "BadgePrintSettings" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "labelSize" "BadgeLabelSize" NOT NULL DEFAULT 'LABEL_2X3',
    "showChildName" BOOLEAN NOT NULL DEFAULT true,
    "showRegistrationNumber" BOOLEAN NOT NULL DEFAULT true,
    "showClassroomName" BOOLEAN NOT NULL DEFAULT true,
    "showBadgeDisplayName" BOOLEAN NOT NULL DEFAULT true,
    "showCheckInLabel" BOOLEAN NOT NULL DEFAULT false,
    "showSeasonName" BOOLEAN NOT NULL DEFAULT true,
    "showQrCode" BOOLEAN NOT NULL DEFAULT true,
    "showAllergyFlag" BOOLEAN NOT NULL DEFAULT false,
    "logoUrl" TEXT,
    "autoPrintOnCheckIn" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BadgePrintSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BadgePrintSettings_seasonId_key" ON "BadgePrintSettings"("seasonId");

-- AddForeignKey
ALTER TABLE "BadgePrintSettings" ADD CONSTRAINT "BadgePrintSettings_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "VbsSeason"("id") ON DELETE CASCADE ON UPDATE CASCADE;
