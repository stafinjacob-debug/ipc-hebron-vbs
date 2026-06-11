import { auth } from "@/auth";
import { loadSeasonAttendanceContext } from "@/lib/attendance";
import { prisma } from "@/lib/prisma";
import { resolveBadgePrintSettings } from "@/lib/badge-print";
import { canManageDirectory, canViewOperations } from "@/lib/roles";
import { AttendanceExportPanel } from "@/components/reports/attendance-export-panel";
import { BarChart3, Printer } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function ReportsPage() {
  const session = await auth();
  if (!session?.user?.role) redirect("/login");
  if (!canViewOperations(session.user.role)) redirect("/dashboard");

  const [activeSeason, seasons] = await Promise.all([
    prisma.vbsSeason.findFirst({
      where: { isActive: true },
      orderBy: [{ year: "desc" }, { startDate: "desc" }],
      include: { badgePrintSettings: true },
    }),
    prisma.vbsSeason.findMany({
      orderBy: [{ year: "desc" }, { startDate: "desc" }],
      select: {
        id: true,
        name: true,
        year: true,
        multiDayCheckInEnabled: true,
        startDate: true,
        endDate: true,
      },
    }),
  ]);

  const badgeSettings = resolveBadgePrintSettings(activeSeason?.badgePrintSettings);
  const canConfigure = canManageDirectory(session.user.role);

  const seasonExportOptions = await Promise.all(
    seasons.map(async (season) => {
      const context = await loadSeasonAttendanceContext(season.id);
      return {
        id: season.id,
        name: season.name,
        year: season.year,
        multiDayCheckInEnabled: season.multiDayCheckInEnabled,
        campDates: context?.campDates ?? [],
        defaultCampDate: context?.defaultCampDate ?? "",
      };
    }),
  );

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <BarChart3 className="size-7 text-brand" aria-hidden />
          Reports
        </h1>
        <p className="mt-1 text-muted">Rosters, exports, and printable materials.</p>
      </div>
      <div className="space-y-4 rounded-xl border border-foreground/10 bg-surface-elevated p-6 shadow-sm">
        <div className="flex gap-3">
          <Printer className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden />
          <div>
            <p className="font-medium text-foreground">Print badges</p>
            <p className="mt-1 text-sm text-muted">
              Print thermal name badges from the{" "}
              <Link href="/check-in" className="font-medium text-brand underline">
                check-in desk
              </Link>{" "}
              on an iPad connected to your label printer. Reprint individual badges from a{" "}
              <Link href="/registrations" className="font-medium text-brand underline">
                registration
              </Link>{" "}
              detail page.
            </p>
            {activeSeason && badgeSettings.enabled ? (
              <p className="mt-2 text-sm text-muted">
                Active season: <span className="font-medium text-foreground">{activeSeason.name}</span>
                {canConfigure ? (
                  <>
                    {" "}
                    —{" "}
                    <Link
                      href={`/seasons/${activeSeason.id}/badge-settings`}
                      className="font-medium text-brand underline"
                    >
                      Configure badge layout
                    </Link>
                  </>
                ) : null}
              </p>
            ) : activeSeason ? (
              <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">
                Badge printing is off for {activeSeason.name}.
                {canConfigure ? (
                  <>
                    {" "}
                    <Link
                      href={`/seasons/${activeSeason.id}/badge-settings`}
                      className="font-medium underline"
                    >
                      Enable in badge settings
                    </Link>
                  </>
                ) : null}
              </p>
            ) : (
              <p className="mt-2 text-sm text-muted">Set an active season to print badges.</p>
            )}
          </div>
        </div>
        <div className="flex gap-3 border-t border-foreground/10 pt-4">
          <BarChart3 className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="font-medium text-foreground">Attendance export</p>
            <p className="mt-1 text-sm text-muted">
              Download a CSV of who checked in, checked out, or has not arrived for a specific camp day.
            </p>
            <div className="mt-4">
              <AttendanceExportPanel seasons={seasonExportOptions} />
            </div>
          </div>
        </div>
        <Link
          href="/check-in"
          className="inline-flex rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-foreground hover:opacity-90"
        >
          Open check-in desk
        </Link>
      </div>
    </div>
  );
}
