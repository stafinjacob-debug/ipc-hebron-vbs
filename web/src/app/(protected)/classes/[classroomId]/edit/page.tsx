import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageDirectory, canViewOperations } from "@/lib/roles";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { listAssignableChildFieldsForSeason } from "@/lib/classroom-child-field-options";
import { ClassroomForm } from "../../classroom-form";
import { ClassroomLeadersForm } from "../../classroom-leaders-form";

export default async function EditClassPage({
  params,
}: {
  params: Promise<{ classroomId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.role) redirect("/login");
  if (!canViewOperations(session.user.role)) redirect("/dashboard");
  if (!canManageDirectory(session.user.role)) redirect("/classes");

  const { classroomId } = await params;

  const [c, seasons, staff] = await Promise.all([
    prisma.classroom.findUnique({
      where: { id: classroomId },
      include: {
        leaderAssignments: { select: { userId: true, role: true } },
      },
    }),
    prisma.vbsSeason.findMany({
      orderBy: [{ year: "desc" }, { startDate: "desc" }],
      select: { id: true, name: true, year: true },
    }),
    prisma.user.findMany({
      where: { status: "ACTIVE", role: { not: "PARENT" } },
      select: { id: true, name: true, email: true, role: true },
      orderBy: [{ name: "asc" }, { email: "asc" }],
    }),
  ]);

  if (!c) notFound();

  const assignableChildFields = await listAssignableChildFieldsForSeason(c.seasonId);

  const primaryId = c.leaderAssignments.find((x) => x.role === "PRIMARY")?.userId ?? null;
  const assistantIds = c.leaderAssignments
    .filter((x) => x.role !== "PRIMARY")
    .map((x) => x.userId);

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <div>
        <Link href={`/classes/${c.id}`} className="text-sm font-medium text-brand underline">
          ← {c.name}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Edit class</h1>
      </div>
      <ClassroomForm
        mode="edit"
        classroom={c}
        seasonId={c.seasonId}
        seasons={seasons}
        assignableChildFields={assignableChildFields}
      />
      <ClassroomLeadersForm
        classroomId={c.id}
        staff={staff}
        primaryId={primaryId}
        assistantIds={assistantIds}
      />
    </div>
  );
}
