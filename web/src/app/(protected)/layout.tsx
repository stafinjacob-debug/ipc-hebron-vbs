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

  const [seasons, dbRow] = await Promise.all([
    prisma.vbsSeason.findMany({
      orderBy: [{ year: "desc" }, { startDate: "desc" }],
      select: { id: true, name: true, year: true },
    }),
    findUserRawByEmail(session.user.email),
  ]);

  if (!dbRow) redirect("/login");

  const role = normalizeStaffRole(dbRow.role);

  return (
    <AppShell
      email={session.user.email}
      displayName={dbRow.name ?? session.user.name ?? null}
      role={role}
      seasons={seasons}
    >
      {children}
    </AppShell>
  );
}
