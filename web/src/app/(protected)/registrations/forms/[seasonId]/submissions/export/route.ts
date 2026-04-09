import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canViewOperations } from "@/lib/roles";

function csvCell(s: string) {
  return `"${String(s).replace(/"/g, '""')}"`;
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ seasonId: string }> },
) {
  const session = await auth();
  if (!session?.user?.role || !canViewOperations(session.user.role)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { seasonId } = await context.params;

  const season = await prisma.vbsSeason.findUnique({ where: { id: seasonId } });
  if (!season) {
    return new Response("Not found", { status: 404 });
  }

  const rows = await prisma.formSubmission.findMany({
    where: { seasonId },
    orderBy: { submittedAt: "desc" },
    include: {
      guardian: true,
      registrations: { include: { child: true } },
    },
  });

  const header = [
    "registrationCode",
    "submittedAt",
    "guardianFirstName",
    "guardianLastName",
    "guardianEmail",
    "guardianPhone",
    "childFirstName",
    "childLastName",
    "childDob",
    "registrationStatus",
    "staffNotes",
    "guardianResponsesJson",
  ];

  const lines: string[] = [header.join(",")];

  for (const s of rows) {
    const g = s.guardian;
    const responses = JSON.stringify(s.guardianResponses ?? {});
    if (s.registrations.length === 0) {
      lines.push(
        [
          csvCell(s.registrationCode),
          csvCell(s.submittedAt.toISOString()),
          csvCell(g.firstName),
          csvCell(g.lastName),
          csvCell(g.email ?? ""),
          csvCell(g.phone ?? ""),
          csvCell(""),
          csvCell(""),
          csvCell(""),
          csvCell(""),
          csvCell(""),
          csvCell(responses),
        ].join(","),
      );
      continue;
    }
    for (const r of s.registrations) {
      lines.push(
        [
          csvCell(s.registrationCode),
          csvCell(s.submittedAt.toISOString()),
          csvCell(g.firstName),
          csvCell(g.lastName),
          csvCell(g.email ?? ""),
          csvCell(g.phone ?? ""),
          csvCell(r.child.firstName),
          csvCell(r.child.lastName),
          csvCell(r.child.dateOfBirth.toISOString().slice(0, 10)),
          csvCell(r.status),
          csvCell(r.notes ?? ""),
          csvCell(responses),
        ].join(","),
      );
    }
  }

  const csv = lines.join("\n");
  const filename = `vbs-registrations-${season.year}-${seasonId.slice(0, 8)}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
