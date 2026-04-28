import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { ReplyForm } from "@/app/(protected)/messages/reply-form";
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

export default async function MessageDetailPage({
  params,
}: {
  params: Promise<{ messageId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.role) redirect("/login");
  if (!canViewOperations(session.user.role)) redirect("/dashboard");

  const { messageId } = await params;
  const message = await prisma.incomingMessage.findUnique({
    where: { id: messageId },
    include: {
      replies: {
        orderBy: { createdAt: "desc" },
        include: { sentBy: { select: { name: true, email: true } } },
      },
    },
  });
  if (!message) notFound();

  const canReply = canManageDirectory(session.user.role);

  return (
    <section className="space-y-5">
      <div className="space-y-2">
        <Link href="/messages" className="text-sm font-medium text-brand hover:underline">
          Back to inbox
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{message.subject}</h1>
        <p className="text-sm text-muted">
          From {message.fromName || message.fromAddress} ({message.fromAddress}) on {formatDateTime(message.receivedAt)}
        </p>
      </div>

      <div className="rounded-xl border border-foreground/10 bg-surface-elevated p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/70">Message</h2>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
          {message.bodyText || message.bodyPreview || "(No body content.)"}
        </p>
      </div>

      <div className="rounded-xl border border-foreground/10 bg-surface-elevated p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/70">Replies</h2>
        {message.replies.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No replies sent yet.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {message.replies.map((reply) => (
              <article key={reply.id} className="rounded-lg border border-foreground/10 bg-background p-3">
                <p className="text-xs text-muted">
                  {reply.sentBy?.name || reply.sentBy?.email || "Staff"} - {formatDateTime(reply.createdAt)}
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm text-foreground/90">{reply.replyBodyText}</p>
              </article>
            ))}
          </div>
        )}
      </div>

      {canReply ? (
        <div className="rounded-xl border border-foreground/10 bg-surface-elevated p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/70">Reply</h2>
          <div className="mt-3">
            <ReplyForm incomingMessageId={message.id} />
          </div>
        </div>
      ) : null}
    </section>
  );
}
