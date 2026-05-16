-- Sent Items synced from M365 (staff compose + automated sends with saveToSentItems).
CREATE TABLE "SentMailboxMessage" (
    "id" TEXT NOT NULL,
    "graphMessageId" TEXT NOT NULL,
    "conversationId" TEXT,
    "internetMessageId" TEXT,
    "subject" TEXT NOT NULL,
    "toDisplay" TEXT NOT NULL,
    "toAddressesNormalized" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL,
    "bodyPreview" TEXT,
    "bodyText" TEXT,
    "bodyContentType" TEXT,
    "rawJson" JSONB,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SentMailboxMessage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SentMailboxMessage_graphMessageId_key" ON "SentMailboxMessage"("graphMessageId");
CREATE INDEX "SentMailboxMessage_sentAt_idx" ON "SentMailboxMessage"("sentAt");

CREATE TABLE "SentMailboxSyncState" (
    "id" TEXT NOT NULL,
    "mailbox" TEXT NOT NULL,
    "deltaLink" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SentMailboxSyncState_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SentMailboxSyncState_mailbox_key" ON "SentMailboxSyncState"("mailbox");
