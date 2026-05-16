import { Mail } from "lucide-react";
import { redirect } from "next/navigation";
import { IncomingMessageStatus } from "@/generated/prisma";
import { auth } from "@/auth";
import { MessagesBulkTable } from "@/app/(protected)/messages/messages-bulk-table";
import { MessageSyncButton } from "@/app/(protected)/messages/message-sync-button";
import { MessagesFolderNav } from "@/app/(protected)/messages/messages-folder-nav";
import { SentMessagesTable } from "@/app/(protected)/messages/sent-messages-table";
import { prisma } from "@/lib/prisma";
import { canManageDirectory, canViewOperations } from "@/lib/roles";

function formatDateTime(value: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}

export default async function IncomingMessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; assignment?: string; view?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.role) redirect("/login");
  if (!canViewOperations(session.user.role)) redirect("/dashboard");

  const sp = await searchParams;
  const view = (sp.view ?? "").trim().toLowerCase() === "sent" ? "sent" : "inbox";
  const q = (sp.q ?? "").trim();
  const statusFilter = (sp.status ?? "").trim().toUpperCase();
  const assignmentFilter = (sp.assignment ?? "").trim().toLowerCase();
  const validStatuses: IncomingMessageStatus[] = ["NEW", "OPEN", "REPLIED", "ARCHIVED"];
  const status = validStatuses.includes(statusFilter as IncomingMessageStatus)
    ? (statusFilter as IncomingMessageStatus)
    : undefined;

  const showCompose = canManageDirectory(session.user.role);

  if (view === "sent") {
    const sentWhere = {
      ...(q
        ? {
            OR: [
              { subject: { contains: q, mode: "insensitive" as const } },
              { toDisplay: { contains: q, mode: "insensitive" as const } },
              { toAddressesNormalized: { contains: q, mode: "insensitive" as const } },
              { bodyPreview: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const sentRows = await prisma.sentMailboxMessage.findMany({
      where: sentWhere,
      orderBy: [{ sentAt: "desc" }],
      take: 100,
      select: {
        id: true,
        toDisplay: true,
        toAddressesNormalized: true,
        subject: true,
        bodyPreview: true,
        sentAt: true,
      },
    });

    return (
      <section className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <Mail className="size-6 text-brand" aria-hidden />
              Sent messages
            </h1>
            <p className="mt-1 text-sm text-muted">Synced from your Microsoft 365 Sent Items folder.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <MessagesFolderNav current="sent" showCompose={showCompose} />
            <MessageSyncButton />
          </div>
        </div>

        <form method="get" className="flex flex-wrap items-end gap-2 rounded-xl border border-foreground/10 bg-surface-elevated p-3">
          <input type="hidden" name="view" value="sent" />
          <div className="min-w-[14rem] flex-1">
            <label htmlFor="q" className="block text-xs font-medium text-foreground/70">
              Search
            </label>
            <input
              id="q"
              name="q"
              type="search"
              defaultValue={q}
              placeholder="Subject, recipients, preview…"
              className="mt-1 w-full rounded-md border border-foreground/15 bg-background px-2.5 py-2 text-sm"
            />
          </div>
          <button type="submit" className="rounded-md bg-brand px-3 py-2 text-sm font-semibold text-white">
            Apply
          </button>
        </form>

        <SentMessagesTable
          rows={sentRows.map((m) => ({
            id: m.id,
            toDisplay: m.toDisplay,
            toAddressesNormalized: m.toAddressesNormalized,
            subject: m.subject,
            bodyPreview: m.bodyPreview,
            sentAtLabel: formatDateTime(m.sentAt),
          }))}
        />
      </section>
    );
  }

  const where = {
    ...(q
      ? {
          OR: [
            { subject: { contains: q, mode: "insensitive" as const } },
            { fromAddress: { contains: q, mode: "insensitive" as const } },
            { fromName: { contains: q, mode: "insensitive" as const } },
            { bodyPreview: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(status ? { status } : {}),
    ...(assignmentFilter === "assigned"
      ? { assignedToUserId: { not: null } }
      : assignmentFilter === "unassigned"
        ? { assignedToUserId: null }
        : {}),
  };

  const assignees = await prisma.user.findMany({
    where: {
      status: "ACTIVE",
      role: { not: "PARENT" },
    },
    select: { id: true, name: true, email: true },
    orderBy: [{ name: "asc" }, { email: "asc" }],
  });

  const messages = await prisma.incomingMessage.findMany({
    where,
    orderBy: [{ receivedAt: "desc" }],
    take: 100,
    include: {
      assignedTo: { select: { name: true, email: true } },
      _count: { select: { replies: true } },
    },
  });

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Mail className="size-6 text-brand" aria-hidden />
            Incoming messages
          </h1>
          <p className="mt-1 text-sm text-muted">Synced from your Microsoft 365 inbox.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <MessagesFolderNav current="inbox" showCompose={showCompose} />
          <MessageSyncButton />
        </div>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-2 rounded-xl border border-foreground/10 bg-surface-elevated p-3">
        <div className="min-w-[14rem] flex-1">
          <label htmlFor="q" className="block text-xs font-medium text-foreground/70">
            Search
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Subject, sender, preview…"
            className="mt-1 w-full rounded-md border border-foreground/15 bg-background px-2.5 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="status" className="block text-xs font-medium text-foreground/70">
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={status ?? ""}
            className="mt-1 rounded-md border border-foreground/15 bg-background px-2.5 py-2 text-sm"
          >
            <option value="">All</option>
            <option value="NEW">NEW</option>
            <option value="OPEN">OPEN</option>
            <option value="REPLIED">REPLIED</option>
            <option value="ARCHIVED">ARCHIVED</option>
          </select>
        </div>
        <div>
          <label htmlFor="assignment" className="block text-xs font-medium text-foreground/70">
            Assignment
          </label>
          <select
            id="assignment"
            name="assignment"
            defaultValue={assignmentFilter || ""}
            className="mt-1 rounded-md border border-foreground/15 bg-background px-2.5 py-2 text-sm"
          >
            <option value="">All</option>
            <option value="assigned">Assigned</option>
            <option value="unassigned">Unassigned</option>
          </select>
        </div>
        <button type="submit" className="rounded-md bg-brand px-3 py-2 text-sm font-semibold text-white">
          Apply
        </button>
      </form>

      <MessagesBulkTable
        assignees={assignees}
        rows={messages.map((m) => ({
          id: m.id,
          fromName: m.fromName,
          fromAddress: m.fromAddress,
          subject: m.subject,
          bodyPreview: m.bodyPreview,
          receivedAtLabel: formatDateTime(m.receivedAt),
          status: m.status,
          assignedToUserId: m.assignedToUserId,
          assignedToNameOrEmail: m.assignedTo ? m.assignedTo.name || m.assignedTo.email : null,
          repliesCount: m._count.replies,
        }))}
      />
    </section>
  );
}
