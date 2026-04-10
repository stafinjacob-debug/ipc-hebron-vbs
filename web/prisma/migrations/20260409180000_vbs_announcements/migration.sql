-- CreateTable
CREATE TABLE "VbsAnnouncement" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "seasonId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "audience" TEXT NOT NULL DEFAULT 'STAFF',
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "createdByUserId" TEXT,

    CONSTRAINT "VbsAnnouncement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VbsAnnouncement_seasonId_idx" ON "VbsAnnouncement"("seasonId");

-- AddForeignKey
ALTER TABLE "VbsAnnouncement" ADD CONSTRAINT "VbsAnnouncement_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "VbsSeason"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VbsAnnouncement" ADD CONSTRAINT "VbsAnnouncement_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
