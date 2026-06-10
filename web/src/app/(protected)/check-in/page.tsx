import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { resolveBadgePrintSettings } from "@/lib/badge-print";
import { canUseCheckInActions } from "@/lib/permissions";
import { ClipboardCheck } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckInDeskClient } from "./check-in-desk-client";

export default async function CheckInPage() {
  const session = await auth();
  if (!session?.user?.role) redirect("/login");
  if (!canUseCheckInActions(session.user.role)) redirect("/dashboard");

  const activeSeason = await prisma.vbsSeason.findFirst({
    where: { isActive: true },
    orderBy: [{ year: "desc" }, { startDate: "desc" }],
    include: { badgePrintSettings: true },
  });

  const rows = activeSeason
    ? await prisma.registration.findMany({
        where: { seasonId: activeSeason.id, status: { not: "CANCELLED" } },
        orderBy: [{ checkedInAt: "asc" }, { child: { lastName: "asc" } }],
        include: {
          child: true,
          classroom: true,
          formSubmission: { select: { registrationCode: true } },
        },
      })
    : [];

  const badgeSettings = resolveBadgePrintSettings(activeSeason?.badgePrintSettings);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <ClipboardCheck className="size-7 text-brand" aria-hidden />
            Check-in desk
          </h1>
          <p className="mt-1 text-muted">
            Mark arrivals for your active VBS season. Scan a QR code or search by name or registration code to find a
            child, then check in and print badges from an iPad.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="text-sm font-medium text-brand underline-offset-4 hover:underline"
        >
          Back to dashboard
        </Link>
      </div>

      {!activeSeason && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-4 text-sm text-foreground">
          <p className="font-medium text-amber-900 dark:text-amber-100">No active season</p>
          <p className="mt-1 text-foreground/80">
            Set a season as active under{" "}
            <Link href="/seasons" className="font-medium text-brand underline">
              VBS seasons
            </Link>{" "}
            to use check-in.
          </p>
        </div>
      )}

      {activeSeason && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
          <p>
            Checking in: <span className="font-medium text-foreground">{activeSeason.name}</span>
          </p>
          {badgeSettings.enabled ? (
            <Link
              href={`/seasons/${activeSeason.id}/badge-settings`}
              className="font-medium text-brand underline-offset-4 hover:underline"
            >
              Badge settings
            </Link>
          ) : (
            <span className="text-amber-700 dark:text-amber-300">Badge printing is off for this season.</span>
          )}
        </div>
      )}

      {activeSeason && (
        <CheckInDeskClient
          seasonId={activeSeason.id}
          badgePrintingEnabled={badgeSettings.enabled}
          autoPrintOnCheckIn={badgeSettings.autoPrintOnCheckIn}
          rows={rows.map((r) => ({
            id: r.id,
            studentName: `${r.child.firstName} ${r.child.lastName}`,
            className: r.classroom?.name ?? "—",
            checkedIn: Boolean(r.checkedInAt),
            registrationNumber: r.registrationNumber,
            submissionCode: r.formSubmission?.registrationCode ?? null,
          }))}
        />
      )}
    </div>
  );
}
