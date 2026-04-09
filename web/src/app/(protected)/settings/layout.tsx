import { auth } from "@/auth";
import { canManageUsers, canViewOperations } from "@/lib/roles";
import { redirect } from "next/navigation";
import { SettingsSubnav } from "./settings-subnav";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.role) redirect("/login");
  if (!canViewOperations(session.user.role)) redirect("/dashboard");

  const showUsers = canManageUsers(session.user.role);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-foreground/70">Church-wide preferences and access.</p>
      </div>
      <SettingsSubnav showUsers={showUsers} />
      {children}
    </div>
  );
}
