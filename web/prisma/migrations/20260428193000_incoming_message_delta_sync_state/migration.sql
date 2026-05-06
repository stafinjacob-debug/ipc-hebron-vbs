-- Stores Graph delta token/link per mailbox for incremental sync.
CREATE TABLE "IncomingMessageSyncState" (
    "id" TEXT NOT NULL,
    "mailbox" TEXT NOT NULL,
    "deltaLink" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IncomingMessageSyncState_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IncomingMessageSyncState_mailbox_key" ON "IncomingMessageSyncState"("mailbox");
