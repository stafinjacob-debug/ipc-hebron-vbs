"use server";

import { revalidatePath } from "next/cache";
import { IncomingMessageStatus } from "@/generated/prisma";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageDirectory, canViewOperations } from "@/lib/roles";
import {
  configuredGraphMailboxAddress,
  type GraphMailboxMessage,
  listInboxMessages,
  replyToMessageViaGraph,
  syncInboxMessagesByDelta,
} from "@/lib/messages/graph-mailbox";

export type IncomingMessageActionState = {
  ok: boolean;
  message?: string;
  error?: string;
};

export async function syncIncomingMessagesAction(_prevState: IncomingMessageActionState): Promise<IncomingMessageActionState> {
  void _prevState;
  const session = await auth();
  if (!session?.user?.role || !canViewOperations(session.user.role)) {
    return { ok: false, error: "You do not have permission to sync messages." };
  }

  const mailbox = configuredGraphMailboxAddress();
  if (!mailbox) return { ok: false, error: "MICROSOFT_GRAPH_MAILBOX is not configured." };

  const syncState = await prisma.incomingMessageSyncState.findUnique({
    where: { mailbox: mailbox.toLowerCase() },
  });

  let usedDeltaFallback = false;
  let messages: GraphMailboxMessage[] = [];
  let removedIds: string[] = [];
  let deltaLink: string | null = syncState?.deltaLink ?? null;

  const delta = await syncInboxMessagesByDelta(syncState?.deltaLink ?? null);
  if (delta.ok) {
    messages = delta.result.messages;
    removedIds = delta.result.removedIds;
    deltaLink = delta.result.deltaLink;
  } else if (syncState?.deltaLink) {
    usedDeltaFallback = true;
    const full = await listInboxMessages(100);
    if (!full.ok) return { ok: false, error: `${delta.error} Fallback failed: ${full.error}` };
    messages = full.messages;
    removedIds = [];
    deltaLink = null;
  } else {
    return { ok: false, error: delta.error };
  }

  const now = new Date();
  await prisma.$transaction([
    ...messages.map((m) =>
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
    ...(removedIds.length
      ? [
          prisma.incomingMessage.updateMany({
            where: { graphMessageId: { in: removedIds } },
            data: { status: "ARCHIVED", lastSyncedAt: now },
          }),
        ]
      : []),
    prisma.incomingMessageSyncState.upsert({
      where: { mailbox: mailbox.toLowerCase() },
      create: {
        mailbox: mailbox.toLowerCase(),
        deltaLink,
        lastSyncedAt: now,
      },
      update: {
        deltaLink,
        lastSyncedAt: now,
      },
    }),
  ]);

  revalidatePath("/messages");
  const fallbackSuffix = usedDeltaFallback ? " (delta reset fallback used)" : "";
  return {
    ok: true,
    message: `Synced ${messages.length} updates${removedIds.length ? `, archived ${removedIds.length} removed` : ""}${fallbackSuffix}.`,
  };
}

export async function replyToIncomingMessageAction(_prevState: IncomingMessageActionState, formData: FormData): Promise<IncomingMessageActionState> {
  void _prevState;
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

export async function updateIncomingMessageMetaAction(
  _prevState: IncomingMessageActionState,
  formData: FormData,
): Promise<IncomingMessageActionState> {
  void _prevState;
  const session = await auth();
  if (!session?.user?.role || !canManageDirectory(session.user.role)) {
    return { ok: false, error: "You do not have permission to update messages." };
  }

  const messageId = String(formData.get("incomingMessageId") ?? "").trim();
  const statusRaw = String(formData.get("status") ?? "").trim();
  const assignedToRaw = String(formData.get("assignedToUserId") ?? "").trim();
  if (!messageId) return { ok: false, error: "Missing message id." };

  const allowedStatuses = new Set<IncomingMessageStatus>(["NEW", "OPEN", "REPLIED", "ARCHIVED"]);
  if (!allowedStatuses.has(statusRaw as IncomingMessageStatus)) {
    return { ok: false, error: "Invalid status." };
  }
  const status = statusRaw as IncomingMessageStatus;

  let assignedToUserId: string | null = null;
  if (assignedToRaw) {
    const assignee = await prisma.user.findUnique({
      where: { id: assignedToRaw },
      select: { id: true, role: true, status: true },
    });
    if (!assignee || assignee.role === "PARENT" || assignee.status !== "ACTIVE") {
      return { ok: false, error: "Invalid assignee." };
    }
    assignedToUserId = assignee.id;
  }

  await prisma.incomingMessage.update({
    where: { id: messageId },
    data: {
      status,
      assignedToUserId,
    },
  });

  revalidatePath("/messages");
  revalidatePath(`/messages/${messageId}`);
  return { ok: true, message: "Message updated." };
}

export async function bulkUpdateIncomingMessagesAction(
  _prevState: IncomingMessageActionState,
  formData: FormData,
): Promise<IncomingMessageActionState> {
  void _prevState;
  const session = await auth();
  if (!session?.user?.role || !canManageDirectory(session.user.role)) {
    return { ok: false, error: "You do not have permission to update messages." };
  }

  const messageIds = formData
    .getAll("messageIds")
    .map((v) => String(v).trim())
    .filter(Boolean);
  if (!messageIds.length) return { ok: false, error: "Select at least one message." };

  const statusRaw = String(formData.get("status") ?? "KEEP").trim();
  const assignmentRaw = String(formData.get("assignedToUserId") ?? "KEEP").trim();

  const data: { status?: IncomingMessageStatus; assignedToUserId?: string | null } = {};
  if (statusRaw !== "KEEP") {
    const allowedStatuses = new Set<IncomingMessageStatus>(["NEW", "OPEN", "REPLIED", "ARCHIVED"]);
    if (!allowedStatuses.has(statusRaw as IncomingMessageStatus)) {
      return { ok: false, error: "Invalid status." };
    }
    data.status = statusRaw as IncomingMessageStatus;
  }

  if (assignmentRaw !== "KEEP") {
    if (assignmentRaw === "") {
      data.assignedToUserId = null;
    } else {
      const assignee = await prisma.user.findUnique({
        where: { id: assignmentRaw },
        select: { id: true, role: true, status: true },
      });
      if (!assignee || assignee.role === "PARENT" || assignee.status !== "ACTIVE") {
        return { ok: false, error: "Invalid assignee." };
      }
      data.assignedToUserId = assignee.id;
    }
  }

  if (!Object.keys(data).length) {
    return { ok: false, error: "Choose at least one update (status and/or assignment)." };
  }

  const result = await prisma.incomingMessage.updateMany({
    where: { id: { in: messageIds } },
    data,
  });

  revalidatePath("/messages");
  return { ok: true, message: `Updated ${result.count} message(s).` };
}
