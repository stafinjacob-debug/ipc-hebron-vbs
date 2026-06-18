import { auth } from "@/auth";
import { loadAttendanceExportRows } from "@/lib/attendance";
import { formatCampDateForExport } from "@/lib/camp-date";
import { formatAppDateTime } from "@/lib/app-timezone";
import { prisma } from "@/lib/prisma";
import { canViewOperations } from "@/lib/roles";

function csvCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function formatTimestamp(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return formatAppDateTime(d, {
    month: "numeric",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: undefined,
  });
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.role || !canViewOperations(session.user.role)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const url = new URL(req.url);
  const seasonId = url.searchParams.get("season")?.trim() ?? "";
  const campDate = url.searchParams.get("date")?.trim() ?? "";
  if (!seasonId || !campDate) {
    return new Response("Missing season or date", { status: 400 });
  }

  const season = await prisma.vbsSeason.findUnique({
    where: { id: seasonId },
    select: { name: true, year: true },
  });
  if (!season) return new Response("Not found", { status: 404 });

  const rows = await loadAttendanceExportRows(seasonId, campDate);
  const header = [
    "Camp date",
    "Student name",
    "Registration number",
    "Class",
    "Guardian name",
    "Guardian phone",
    "Status",
    "Checked in at",
    "Checked out at",
  ];

  const lines = [
    header.map(csvCell).join(","),
    ...rows.map((row) =>
      [
        formatCampDateForExport(campDate),
        row.studentName,
        row.registrationNumber ?? "",
        row.className ?? "",
        row.guardianName,
        row.guardianPhone ?? "",
        row.status,
        formatTimestamp(row.checkedInAt),
        formatTimestamp(row.checkedOutAt),
      ]
        .map(csvCell)
        .join(","),
    ),
  ];

  const safeSeason = season.name.replace(/[^a-z0-9-_]+/gi, "-").replace(/-+/g, "-");
  const filename = `attendance-${safeSeason}-${campDate}.csv`;

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
