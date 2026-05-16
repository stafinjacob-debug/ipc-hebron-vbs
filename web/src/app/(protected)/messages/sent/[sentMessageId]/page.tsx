import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { MessagesFolderNav } from "@/app/(protected)/messages/messages-folder-nav";
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

export default async function SentMessageDetailPage({
  params,
}: {
  params: Promise<{ sentMessageId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.role) redirect("/login");
  if (!canViewOperations(session.user.role)) redirect("/dashboard");

  const showCompose = canManageDirectory(session.user.role);

  const { sentMessageId } = await params;
  const message = await prisma.sentMailboxMessage.findUnique({
    where: { id: sentMessageId },
  });
  if (!message) notFound();

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Sent message</h1>
        <MessagesFolderNav current="sent" showCompose={showCompose} />
      </div>

      <div className="space-y-2">
        <Link href="/messages?view=sent" className="text-sm font-medium text-brand hover:underline">
          Back to sent
        </Link>
        <h2 className="text-xl font-semibold tracking-tight">{message.subject}</h2>
        <p className="text-sm text-muted">
          To {message.toDisplay} · {formatDateTime(message.sentAt)}
        </p>
        <p className="text-xs text-muted">{message.toAddressesNormalized.replace(/;/g, " · ")}</p>
      </div>

      <div className="rounded-xl border border-foreground/10 bg-surface-elevated p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/70">Message</h2>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
          {message.bodyText || message.bodyPreview || "(No body content.)"}
        </p>
      </div>
    </section>
  );
}
