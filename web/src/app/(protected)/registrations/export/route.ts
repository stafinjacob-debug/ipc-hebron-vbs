import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_EXPORT_FIELD_KEYS,
  buildRegistrationExportFieldOptionsFromJson,
} from "@/lib/registration-export";
import { canViewOperations } from "@/lib/roles";

function csvCell(s: string) {
  return `"${String(s).replace(/"/g, '""')}"`;
}

function asObject(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function valueToCell(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (v instanceof Date) return v.toISOString();
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.role || !canViewOperations(session.user.role)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const url = new URL(req.url);
  const seasonId = url.searchParams.get("season")?.trim() ?? "";
  if (!seasonId) return new Response("Missing season", { status: 400 });

  const season = await prisma.vbsSeason.findUnique({
    where: { id: seasonId },
    select: {
      id: true,
      year: true,
      name: true,
      registrationForm: { select: { publishedDefinitionJson: true, draftDefinitionJson: true } },
    },
  });
  if (!season) return new Response("Not found", { status: 404 });

  const options = buildRegistrationExportFieldOptionsFromJson(
    season.registrationForm?.publishedDefinitionJson ?? season.registrationForm?.draftDefinitionJson,
  );
  const optionMap = new Map(options.map((o) => [o.key, o]));
  const all = url.searchParams.get("all") === "1";
  const requested = url.searchParams.getAll("column");
  const selected = all
    ? options.map((o) => o.key)
    : requested.filter((k, i) => optionMap.has(k) && requested.indexOf(k) === i);
  const columns = selected.length > 0 ? selected : DEFAULT_EXPORT_FIELD_KEYS.filter((k) => optionMap.has(k));

  const rows = await prisma.registration.findMany({
    where: { seasonId },
    orderBy: { registeredAt: "desc" },
    include: {
      child: { include: { guardian: true } },
      classroom: true,
      formSubmission: { select: { registrationCode: true, guardianResponses: true } },
    },
  });

  const header = columns.map((k) => optionMap.get(k)?.label ?? k);
  const lines: string[] = [header.map(csvCell).join(",")];

  for (const r of rows) {
    const guardianExtra = asObject(r.formSubmission?.guardianResponses);
    const childExtra = asObject(r.customResponses);
    const values = columns.map((k) => {
      if (k === "registrationId") return r.id;
      if (k === "registrationNumber") return r.registrationNumber ?? "";
      if (k === "status") return r.status;
      if (k === "registeredAt") return r.registeredAt.toISOString();
      if (k === "seasonName") return season.name;
      if (k === "classroomName") return r.classroom?.name ?? "";
      if (k === "submissionCode") return r.formSubmission?.registrationCode ?? "";
      if (k === "staffNotes") return r.notes ?? "";
      if (k.startsWith("guardian:")) {
        const fld = k.slice("guardian:".length);
        if (fld === "guardianFirstName") return r.child.guardian.firstName;
        if (fld === "guardianLastName") return r.child.guardian.lastName;
        if (fld === "guardianEmail") return r.child.guardian.email ?? "";
        if (fld === "guardianPhone") return r.child.guardian.phone ?? "";
        return valueToCell(guardianExtra[fld]);
      }
      if (k.startsWith("child:")) {
        const fld = k.slice("child:".length);
        if (fld === "childFirstName") return r.child.firstName;
        if (fld === "childLastName") return r.child.lastName;
        if (fld === "childDateOfBirth") return r.child.dateOfBirth.toISOString().slice(0, 10);
        if (fld === "allergiesNotes") return r.child.allergiesNotes ?? "";
        return valueToCell(childExtra[fld]);
      }
      return "";
    });
    lines.push(values.map(csvCell).join(","));
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
