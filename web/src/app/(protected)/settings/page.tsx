import { auth } from "@/auth";
import { canManageDirectory, canViewOperations } from "@/lib/roles";
import { CalendarDays, Globe, Settings2 } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function SettingsGeneralPage() {
  const session = await auth();
  if (!session?.user?.role) redirect("/login");
  if (!canViewOperations(session.user.role)) redirect("/dashboard");

  const canEdit = canManageDirectory(session.user.role);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <Settings2 className="size-6 text-brand" aria-hidden />
          General
        </h2>
        <p className="mt-1 text-sm text-foreground/70">Seasons, public signup, and quick links.</p>
      </div>

      <ul className="grid gap-4 sm:grid-cols-2">
        <li className="rounded-xl border border-foreground/10 bg-surface-elevated p-5 shadow-sm">
          <CalendarDays className="size-8 text-brand" aria-hidden />
          <h3 className="mt-3 font-semibold text-foreground">VBS seasons & events</h3>
          <p className="mt-1 text-sm text-muted">Years, dates, themes, and which season is active.</p>
          <Link
            href="/seasons"
            className="mt-4 inline-flex text-sm font-medium text-brand underline-offset-4 hover:underline"
          >
            Open seasons
          </Link>
        </li>
        {canEdit && (
          <li className="rounded-xl border border-foreground/10 bg-surface-elevated p-5 shadow-sm">
            <Globe className="size-8 text-brand" aria-hidden />
            <h3 className="mt-3 font-semibold text-foreground">Public registration form</h3>
            <p className="mt-1 text-sm text-muted">Welcome text, required fields, and background image per season.</p>
            <Link
              href="/seasons"
              className="mt-4 inline-flex text-sm font-medium text-brand underline-offset-4 hover:underline"
            >
              Choose a season → Public form settings
            </Link>
          </li>
        )}
        <li className="rounded-xl border border-foreground/10 bg-surface-elevated p-5 shadow-sm sm:col-span-2">
          <h3 className="font-semibold text-foreground">Your account</h3>
          <p className="mt-1 text-sm text-muted">
            Signed in as <span className="font-medium text-foreground">{session.user.email}</span> (
            {session.user.role}).
          </p>
          <p className="mt-2 text-sm text-muted">
            Use the menu (top right) to sign out. Admins can manage other users under{" "}
            <strong className="text-foreground/80">Users & access</strong>.
          </p>
        </li>
      </ul>
    </div>
  );
}
