import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppShell } from "@/components/layout/app-shell";
import { normalizeStaffRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { findUserRawByEmail } from "@/lib/user-auth-raw";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.email || !session.user.role) {
    redirect("/login");
  }

  let dbRow: Awaited<ReturnType<typeof findUserRawByEmail>> | undefined;
  try {
    dbRow = await findUserRawByEmail(session.user.email);
  } catch {
    dbRow = undefined;
  }

  if (dbRow === undefined) {
    const role = normalizeStaffRole(session.user.role);
    let seasons: { id: string; name: string; year: number }[] = [];
    let seasonsLoaded = false;
    try {
      seasons = await prisma.vbsSeason.findMany({
        orderBy: [{ year: "desc" }, { startDate: "desc" }],
        select: { id: true, name: true, year: true },
      });
      seasonsLoaded = true;
    } catch {
      seasons = [];
    }

    const databaseNotice = !seasonsLoaded
      ? "Could not reach the database. Season lists and most staff pages will fail until DATABASE_URL is reachable (check Azure PostgreSQL firewall/VNet rules or use a local database in .env.local)."
      : "Could not verify your staff profile against the database. You are still signed in from your session; retry when the database is reachable.";

    return (
      <AppShell
        email={session.user.email}
        displayName={session.user.name ?? null}
        role={role}
        seasons={seasons}
        databaseNotice={databaseNotice}
      >
        {children}
      </AppShell>
    );
  }

  if (!dbRow) redirect("/login");

  const role = normalizeStaffRole(dbRow.role);

  let seasons: { id: string; name: string; year: number }[] = [];
  let databaseNotice: string | null = null;
  try {
    seasons = await prisma.vbsSeason.findMany({
      orderBy: [{ year: "desc" }, { startDate: "desc" }],
      select: { id: true, name: true, year: true },
    });
  } catch {
    databaseNotice =
      "Could not load seasons from the database. The season switcher is empty until the connection is restored.";
  }

  return (
    <AppShell
      email={session.user.email}
      displayName={dbRow.name ?? session.user.name ?? null}
      role={role}
      seasons={seasons}
      databaseNotice={databaseNotice}
    >
      {children}
    </AppShell>
  );
}
