"use server";

import { revalidatePath } from "next/cache";
import { IncomingMessageStatus } from "@/generated/prisma";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageDirectory, canViewOperations } from "@/lib/roles";
import {
  configuredGraphMailboxAddress,
  type GraphMailboxMessage,
  type GraphSentMailboxMessage,
  listInboxMessages,
  listSentMessages,
  replyToMessageViaGraph,
  syncInboxMessagesByDelta,
  syncSentMessagesByDelta,
} from "@/lib/messages/graph-mailbox";
import { sendMailViaMicrosoftGraph } from "@/lib/email/microsoft-graph";

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

  const mailboxKey = mailbox.toLowerCase();

  const inboxSyncState = await prisma.incomingMessageSyncState.findUnique({
    where: { mailbox: mailboxKey },
  });

  let usedDeltaFallback = false;
  let inboxMessages: GraphMailboxMessage[] = [];
  let inboxRemovedIds: string[] = [];
  let inboxDeltaLink: string | null = inboxSyncState?.deltaLink ?? null;

  const inboxDelta = await syncInboxMessagesByDelta(inboxSyncState?.deltaLink ?? null);
  if (inboxDelta.ok) {
    inboxMessages = inboxDelta.result.messages;
    inboxRemovedIds = inboxDelta.result.removedIds;
    inboxDeltaLink = inboxDelta.result.deltaLink;
  } else if (inboxSyncState?.deltaLink) {
    usedDeltaFallback = true;
    const full = await listInboxMessages(100);
    if (!full.ok) return { ok: false, error: `${inboxDelta.error} Fallback failed: ${full.error}` };
    inboxMessages = full.messages;
    inboxRemovedIds = [];
    inboxDeltaLink = null;
  } else {
    return { ok: false, error: inboxDelta.error };
  }

  const now = new Date();
  await prisma.$transaction([
    ...inboxMessages.map((m) =>
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
    ...(inboxRemovedIds.length
      ? [
          prisma.incomingMessage.updateMany({
            where: { graphMessageId: { in: inboxRemovedIds } },
            data: { status: "ARCHIVED", lastSyncedAt: now },
          }),
        ]
      : []),
    prisma.incomingMessageSyncState.upsert({
      where: { mailbox: mailboxKey },
      create: {
        mailbox: mailboxKey,
        deltaLink: inboxDeltaLink,
        lastSyncedAt: now,
      },
      update: {
        deltaLink: inboxDeltaLink,
        lastSyncedAt: now,
      },
    }),
  ]);

  const sentSyncState = await prisma.sentMailboxSyncState.findUnique({
    where: { mailbox: mailboxKey },
  });

  let sentUsedDeltaFallback = false;
  let sentMessages: GraphSentMailboxMessage[] = [];
  let sentRemovedIds: string[] = [];
  let sentDeltaLink: string | null = sentSyncState?.deltaLink ?? null;

  const sentDelta = await syncSentMessagesByDelta(sentSyncState?.deltaLink ?? null);
  if (sentDelta.ok) {
    sentMessages = sentDelta.result.messages;
    sentRemovedIds = sentDelta.result.removedIds;
    sentDeltaLink = sentDelta.result.deltaLink;
  } else if (sentSyncState?.deltaLink) {
    sentUsedDeltaFallback = true;
    const fullSent = await listSentMessages(100);
    if (!fullSent.ok) {
      revalidatePath("/messages");
      return {
        ok: true,
        message: `Inbox: ${inboxMessages.length} update(s)${inboxRemovedIds.length ? `, ${inboxRemovedIds.length} archived` : ""}${usedDeltaFallback ? " (inbox delta reset fallback)" : ""}. Sent folder could not sync: ${sentDelta.error} Fallback failed: ${fullSent.error}`,
      };
    }
    sentMessages = fullSent.messages;
    sentRemovedIds = [];
    sentDeltaLink = null;
  } else {
    const fullSent = await listSentMessages(100);
    if (!fullSent.ok) {
      revalidatePath("/messages");
      return {
        ok: true,
        message: `Inbox: ${inboxMessages.length} update(s)${inboxRemovedIds.length ? `, ${inboxRemovedIds.length} archived` : ""}${usedDeltaFallback ? " (inbox delta reset fallback)" : ""}. Sent folder unavailable (${sentDelta.error}).`,
      };
    }
    sentMessages = fullSent.messages;
    sentRemovedIds = [];
    sentDeltaLink = null;
  }

  await prisma.$transaction([
    ...sentMessages.map((m) =>
      prisma.sentMailboxMessage.upsert({
        where: { graphMessageId: m.id },
        create: {
          graphMessageId: m.id,
          conversationId: m.conversationId,
          internetMessageId: m.internetMessageId,
          subject: m.subject,
          toDisplay: m.toDisplay,
          toAddressesNormalized: m.toAddressesNormalized,
          sentAt: m.sentAt,
          bodyPreview: m.bodyPreview,
          bodyText: m.bodyContent?.slice(0, 20_000) ?? null,
          bodyContentType: m.bodyContentType,
          rawJson: m,
          lastSyncedAt: now,
        },
        update: {
          conversationId: m.conversationId,
          internetMessageId: m.internetMessageId,
          subject: m.subject,
          toDisplay: m.toDisplay,
          toAddressesNormalized: m.toAddressesNormalized,
          sentAt: m.sentAt,
          bodyPreview: m.bodyPreview,
          bodyText: m.bodyContent?.slice(0, 20_000) ?? null,
          bodyContentType: m.bodyContentType,
          rawJson: m,
          lastSyncedAt: now,
        },
      }),
    ),
    ...(sentRemovedIds.length
      ? [prisma.sentMailboxMessage.deleteMany({ where: { graphMessageId: { in: sentRemovedIds } } })]
      : []),
    prisma.sentMailboxSyncState.upsert({
      where: { mailbox: mailboxKey },
      create: {
        mailbox: mailboxKey,
        deltaLink: sentDeltaLink,
        lastSyncedAt: now,
      },
      update: {
        deltaLink: sentDeltaLink,
        lastSyncedAt: now,
      },
    }),
  ]);

  revalidatePath("/messages");
  revalidatePath("/messages/sent");
  const inboxSuffix = usedDeltaFallback ? " (inbox delta reset fallback)" : "";
  const sentSuffix = sentUsedDeltaFallback ? " (sent delta reset fallback)" : "";
  return {
    ok: true,
    message: `Inbox: ${inboxMessages.length} update(s)${inboxRemovedIds.length ? `, ${inboxRemovedIds.length} archived` : ""}${inboxSuffix}. Sent: ${sentMessages.length} update(s)${sentRemovedIds.length ? `, ${sentRemovedIds.length} removed locally` : ""}${sentSuffix}.`,
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

function escapeHtmlEmailBody(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const COMPOSE_TO_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function sendComposedEmailAction(
  _prevState: IncomingMessageActionState,
  formData: FormData,
): Promise<IncomingMessageActionState> {
  void _prevState;
  const session = await auth();
  if (!session?.user?.role || !canManageDirectory(session.user.role)) {
    return { ok: false, error: "You do not have permission to send email." };
  }

  const toRaw = String(formData.get("toAddresses") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();

  if (!toRaw) return { ok: false, error: "Add at least one recipient email." };
  if (!subject) return { ok: false, error: "Subject is required." };
  if (!body) return { ok: false, error: "Message body cannot be empty." };

  const addresses = toRaw
    .split(/[,;\n]+/)
    .map((a) => a.trim())
    .filter(Boolean);
  const invalid = addresses.filter((a) => !COMPOSE_TO_EMAIL_RE.test(a));
  if (invalid.length) return { ok: false, error: `Invalid email address(es): ${invalid.join(", ")}` };
  if (addresses.length > 25) return { ok: false, error: "Too many recipients (max 25)." };

  const [primary, ...additionalToAddresses] = addresses;
  const htmlBody = `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:15px;line-height:1.55;color:#0f172a">${escapeHtmlEmailBody(body).replace(/\r?\n/g, "<br/>")}</div>`;

  const result = await sendMailViaMicrosoftGraph({
    toAddress: primary,
    additionalToAddresses,
    subject,
    htmlBody,
  });
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/messages");
  revalidatePath("/messages/sent");
  revalidatePath("/messages/compose");
  return { ok: true, message: "Email sent." };
}
