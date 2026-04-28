"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageDirectory, canViewOperations } from "@/lib/roles";
import { listInboxMessages, replyToMessageViaGraph } from "@/lib/messages/graph-mailbox";

export type IncomingMessageActionState = {
  ok: boolean;
  message?: string;
  error?: string;
};

export async function syncIncomingMessagesAction(): Promise<IncomingMessageActionState> {
  const session = await auth();
  if (!session?.user?.role || !canViewOperations(session.user.role)) {
    return { ok: false, error: "You do not have permission to sync messages." };
  }

  const result = await listInboxMessages(75);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  const now = new Date();
  await prisma.$transaction(
    result.messages.map((m) =>
      prisma.incomingMessage.upsert({
        where: { graphMessageId: m.id },
        create: {
          graphMessageId: m.id,
          conversationId: m.conversationId,
          internetMessageId: m.internetMessageId,
          subject: m.subject,
          fromName: m.fromName,
          fromAddress: m.fromAddress,
          receivedAt: m.receivedAt,
          bodyPreview: m.bodyPreview,
          bodyText: m.bodyContent?.slice(0, 20_000) ?? null,
          bodyContentType: m.bodyContentType,
          isRead: m.isRead,
          status: "NEW",
          rawJson: m,
          lastSyncedAt: now,
        },
        update: {
          conversationId: m.conversationId,
          internetMessageId: m.internetMessageId,
          subject: m.subject,
          fromName: m.fromName,
          fromAddress: m.fromAddress,
          receivedAt: m.receivedAt,
          bodyPreview: m.bodyPreview,
          bodyText: m.bodyContent?.slice(0, 20_000) ?? null,
          bodyContentType: m.bodyContentType,
          isRead: m.isRead,
          rawJson: m,
          lastSyncedAt: now,
        },
      }),
    ),
  );

  revalidatePath("/messages");
  return { ok: true, message: `Synced ${result.messages.length} inbox messages.` };
}

export async function replyToIncomingMessageAction(formData: FormData): Promise<IncomingMessageActionState> {
  const session = await auth();
  if (!session?.user?.role || !canManageDirectory(session.user.role)) {
    return { ok: false, error: "You do not have permission to send replies." };
  }

  const incomingMessageId = String(formData.get("incomingMessageId") ?? "").trim();
  const replyBody = String(formData.get("replyBody") ?? "").trim();
  if (!incomingMessageId) return { ok: false, error: "Missing message id." };
  if (!replyBody) return { ok: false, error: "Reply cannot be empty." };

  const message = await prisma.incomingMessage.findUnique({
    where: { id: incomingMessageId },
    select: { id: true, graphMessageId: true },
  });
  if (!message) return { ok: false, error: "Message not found." };

  const replyResult = await replyToMessageViaGraph({
    graphMessageId: message.graphMessageId,
    replyText: replyBody,
  });
  if (!replyResult.ok) return { ok: false, error: replyResult.error };

  await prisma.$transaction([
    prisma.incomingMessageReply.create({
      data: {
        incomingMessageId: message.id,
        sentByUserId: session.user.id ?? null,
        replyBodyText: replyBody,
      },
    }),
    prisma.incomingMessage.update({
      where: { id: message.id },
      data: { status: "REPLIED" },
    }),
  ]);

  revalidatePath("/messages");
  revalidatePath(`/messages/${message.id}`);
  return { ok: true, message: "Reply sent." };
}
