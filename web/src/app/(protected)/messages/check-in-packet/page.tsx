import { QrCode } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { CheckInPacketForm } from "@/app/(protected)/messages/check-in-packet-form";
import { MessagesFolderNav } from "@/app/(protected)/messages/messages-folder-nav";
import { prisma } from "@/lib/prisma";
import { canManageDirectory, canViewOperations } from "@/lib/roles";

export default async function CheckInPacketPage() {
  const session = await auth();
  if (!session?.user?.role) redirect("/login");
  if (!canViewOperations(session.user.role)) redirect("/dashboard");
  if (!canManageDirectory(session.user.role)) redirect("/messages");

  const seasons = await prisma.vbsSeason.findMany({
    orderBy: [{ year: "desc" }, { startDate: "desc" }],
    select: { id: true, name: true, year: true },
  });

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <QrCode className="size-6 text-brand" aria-hidden />
            Send check-in packet
          </h1>
          <p className="mt-1 text-sm text-muted">
            Email families their QR check-in cards and an optional shared attachment.
          </p>
        </div>
        <MessagesFolderNav current="check-in-packet" showCompose />
      </div>

      <p className="text-sm text-muted">
        <Link href="/messages" className="font-medium text-brand hover:underline">
          Back to inbox
        </Link>
      </p>

      <div className="max-w-3xl rounded-xl border border-foreground/10 bg-surface-elevated p-5">
        <CheckInPacketForm seasons={seasons} />
      </div>
    </section>
  );
}
