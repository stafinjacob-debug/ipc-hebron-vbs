import { auth } from "@/auth";
import { BarChart3, Printer } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { canViewOperations } from "@/lib/roles";

export default async function ReportsPage() {
  const session = await auth();
  if (!session?.user?.role) redirect("/login");
  if (!canViewOperations(session.user.role)) redirect("/dashboard");

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
              Name badges and labels are not generated in-app yet. Use{" "}
              <Link href="/registrations" className="font-medium text-brand underline">
                registrations
              </Link>{" "}
              or export from your workflow when we add CSV / PDF export.
            </p>
          </div>
        </div>
        <div className="flex gap-3 border-t border-foreground/10 pt-4">
          <BarChart3 className="mt-0.5 size-5 shrink-0 text-muted" aria-hidden />
          <div>
            <p className="font-medium text-foreground">Attendance summaries</p>
            <p className="mt-1 text-sm text-muted">
              Detailed reporting is coming soon. Check-in data is available on the dashboard and check-in desk today.
            </p>
          </div>
        </div>
        <Link
          href="/dashboard"
          className="inline-flex rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-foreground hover:opacity-90"
        >
          View dashboard
        </Link>
      </div>
    </div>
  );
}
