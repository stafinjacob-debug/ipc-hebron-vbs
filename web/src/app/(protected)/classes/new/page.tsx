import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageDirectory, canViewOperations } from "@/lib/roles";
import Link from "next/link";
import { redirect } from "next/navigation";
import { listAssignableChildFieldsForSeason } from "@/lib/classroom-child-field-options";
import { ClassroomForm } from "../classroom-form";

export default async function NewClassPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.role) redirect("/login");
  if (!canViewOperations(session.user.role)) redirect("/dashboard");
  if (!canManageDirectory(session.user.role)) redirect("/classes");

  const sp = await searchParams;
  const seasons = await prisma.vbsSeason.findMany({
    orderBy: [{ year: "desc" }, { startDate: "desc" }],
    select: { id: true, name: true, year: true, isActive: true },
  });
  if (seasons.length === 0) redirect("/seasons");

  const defaultSeasonId = seasons.find((s) => s.isActive)?.id ?? seasons[0]!.id;
  const seasonId = sp.season?.trim() || defaultSeasonId;
  const assignableChildFields = await listAssignableChildFieldsForSeason(seasonId);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/classes" className="text-sm font-medium text-brand underline">
          ← Classes
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">New class</h1>
        <p className="mt-1 text-muted">Define age rules, capacity, and logistics. Save, then assign leaders.</p>
      </div>
      <ClassroomForm
        mode="create"
        seasonId={seasonId}
        seasons={seasons}
        assignableChildFields={assignableChildFields}
      />
    </div>
  );
}
