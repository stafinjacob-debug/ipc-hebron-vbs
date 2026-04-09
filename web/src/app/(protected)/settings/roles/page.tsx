import { auth } from "@/auth";
import type { UserRole } from "@/generated/prisma";
import { ROLE_HELP } from "@/lib/roles";
import { canViewOperations } from "@/lib/roles";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Roles | Settings | IPC Hebron VBS",
};

const ORDER: UserRole[] = [
  "SUPER_ADMIN",
  "CHURCH_ADMIN",
  "REGISTRATION_MANAGER",
  "CHECK_IN_VOLUNTEER",
  "TEACHER",
  "CONTENT_MANAGER",
  "REPORTS_VIEWER",
];

export default async function SettingsRolesPage() {
  const session = await auth();
  if (!session?.user?.role) redirect("/login");
  if (!canViewOperations(session.user.role)) redirect("/dashboard");

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-foreground">Roles</h2>
        <p className="mt-1 max-w-2xl text-sm text-foreground/70">
          Each person gets one role. Roles bundle permissions in plain language—there is no separate
          permission matrix to learn for day-to-day work.
        </p>
      </div>

      <ul className="grid gap-4 sm:grid-cols-2">
        {ORDER.map((key) => {
          const help = ROLE_HELP[key];
          if (help.bullets.length === 0) return null;
          return (
            <li
              key={key}
              className="rounded-xl border border-foreground/10 bg-surface-elevated p-5 shadow-sm"
            >
              <h3 className="font-semibold text-foreground">{help.title}</h3>
              <p className="mt-1 text-sm text-foreground/70">{help.summary}</p>
              <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-foreground/80">
                {help.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>

      <p className="rounded-lg border border-foreground/10 bg-foreground/[0.02] px-4 py-3 text-sm text-foreground/65">
        Custom roles and fine-grained toggles are not part of this first release. If your church needs
        something different, assign the closest role and use optional season or class scope under{" "}
        <strong className="text-foreground/80">Users & access</strong>.
      </p>
    </div>
  );
}
