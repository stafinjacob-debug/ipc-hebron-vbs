import Link from "next/link";
import { Mail } from "lucide-react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { MessageSyncButton } from "@/app/(protected)/messages/message-sync-button";
import { prisma } from "@/lib/prisma";
import { canViewOperations } from "@/lib/roles";

function formatDateTime(value: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}

export default async function IncomingMessagesPage() {
  const session = await auth();
  if (!session?.user?.role) redirect("/login");
  if (!canViewOperations(session.user.role)) redirect("/dashboard");

  const messages = await prisma.incomingMessage.findMany({
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
            Incoming Messages
          </h1>
          <p className="mt-1 text-sm text-muted">Synced from your Microsoft 365 inbox.</p>
        </div>
        <MessageSyncButton />
      </div>

      <div className="overflow-hidden rounded-xl border border-foreground/10 bg-surface-elevated">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-foreground/[0.03] text-left text-xs uppercase tracking-wide text-foreground/60">
            <tr>
              <th className="px-4 py-3">From</th>
              <th className="px-4 py-3">Subject</th>
              <th className="px-4 py-3">Received</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Replies</th>
            </tr>
          </thead>
          <tbody>
            {messages.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted">
                  No messages yet. Click Sync inbox to pull messages from Microsoft 365.
                </td>
              </tr>
            ) : (
              messages.map((message) => (
                <tr key={message.id} className="border-t border-foreground/10 align-top">
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{message.fromName || message.fromAddress}</p>
                    <p className="text-xs text-muted">{message.fromAddress}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/messages/${message.id}`} className="font-medium text-brand hover:underline">
                      {message.subject}
                    </Link>
                    {message.bodyPreview ? (
                      <p className="mt-1 line-clamp-2 text-xs text-muted">{message.bodyPreview}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted">{formatDateTime(message.receivedAt)}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full border border-foreground/15 bg-background px-2 py-1 text-xs font-medium text-foreground/80">
                      {message.status}
                    </span>
                    {message.assignedTo ? (
                      <p className="mt-1 text-xs text-muted">
                        Assigned to {message.assignedTo.name || message.assignedTo.email}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted">{message._count.replies}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
