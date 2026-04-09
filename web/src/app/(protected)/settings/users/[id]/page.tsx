import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { fetchUserForSettingsDetail, fetchUserMetaForSettings } from "@/lib/settings-users-data";
import { canAssignRole, canManageUsers, roleLabel } from "@/lib/roles";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { UserEditForms } from "./user-edit-forms";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await fetchUserMetaForSettings(id);
  return {
    title: u ? `${u.name ?? u.email} | Users | Settings` : "User | Settings",
  };
}

export default async function SettingsUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id || !session.user.role || !canManageUsers(session.user.role)) {
    redirect("/settings");
  }

  const { id } = await params;
  const { payload, legacySchema } = await fetchUserForSettingsDetail(id);

  if (!payload || payload.role === "PARENT") notFound();

  const canSee =
    payload.id === session.user.id || canAssignRole(session.user.role, payload.role);
  if (!canSee) {
    redirect("/settings/users");
  }

  const [seasonsRaw, classroomsRaw] = await Promise.all([
    prisma.vbsSeason.findMany({
      orderBy: [{ year: "desc" }, { name: "asc" }],
      select: { id: true, name: true, year: true },
    }),
    prisma.classroom.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, season: { select: { name: true, year: true } } },
    }),
  ]);

  const seasons = seasonsRaw.map((s) => ({
    id: s.id,
    label: `${s.name} (${s.year})`,
  }));
  const classrooms = classroomsRaw.map((c) => ({
    id: c.id,
    label: `${c.name} — ${c.season.name} ${c.season.year}`,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          {payload.name ?? payload.email}
        </h2>
        <p className="mt-1 text-sm text-foreground/70">
          {roleLabel(payload.role)} · {payload.email}
        </p>
        <Link
          href="/settings/users"
          className="mt-2 inline-block text-sm font-medium text-brand underline-offset-4 hover:underline"
        >
          ← All users
        </Link>
      </div>

      <UserEditForms
        user={payload}
        actorUserId={session.user.id}
        actorRole={session.user.role}
        seasons={seasons}
        classrooms={classrooms}
        legacySchema={legacySchema}
      />
    </div>
  );
}
