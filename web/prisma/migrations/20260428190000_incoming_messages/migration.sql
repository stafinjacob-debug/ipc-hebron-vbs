-- Incoming messages synced from M365 mailbox + staff replies.
CREATE TYPE "IncomingMessageStatus" AS ENUM ('NEW', 'OPEN', 'REPLIED', 'ARCHIVED');

CREATE TABLE "IncomingMessage" (
    "id" TEXT NOT NULL,
    "graphMessageId" TEXT NOT NULL,
    "conversationId" TEXT,
    "internetMessageId" TEXT,
    "subject" TEXT NOT NULL,
    "fromName" TEXT,
    "fromAddress" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "bodyPreview" TEXT,
    "bodyText" TEXT,
    "bodyContentType" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "status" "IncomingMessageStatus" NOT NULL DEFAULT 'NEW',
    "rawJson" JSONB,
    "assignedToUserId" TEXT,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IncomingMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IncomingMessageReply" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "incomingMessageId" TEXT NOT NULL,
    "sentByUserId" TEXT,
    "replyBodyText" TEXT NOT NULL,
    "graphResponseId" TEXT,

    CONSTRAINT "IncomingMessageReply_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IncomingMessage_graphMessageId_key" ON "IncomingMessage"("graphMessageId");
CREATE INDEX "IncomingMessage_receivedAt_idx" ON "IncomingMessage"("receivedAt");
CREATE INDEX "IncomingMessage_status_receivedAt_idx" ON "IncomingMessage"("status", "receivedAt");
CREATE INDEX "IncomingMessage_assignedToUserId_idx" ON "IncomingMessage"("assignedToUserId");
CREATE INDEX "IncomingMessageReply_incomingMessageId_createdAt_idx" ON "IncomingMessageReply"("incomingMessageId", "createdAt");

ALTER TABLE "IncomingMessage"
  ADD CONSTRAINT "IncomingMessage_assignedToUserId_fkey"
  FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "IncomingMessageReply"
  ADD CONSTRAINT "IncomingMessageReply_incomingMessageId_fkey"
  FOREIGN KEY ("incomingMessageId") REFERENCES "IncomingMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "IncomingMessageReply"
  ADD CONSTRAINT "IncomingMessageReply_sentByUserId_fkey"
  FOREIGN KEY ("sentByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
