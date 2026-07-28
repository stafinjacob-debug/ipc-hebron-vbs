import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_EXPORT_FIELD_KEYS,
  buildRegistrationExportFieldOptionsFromJson,
  resolveRegistrationExportFieldValue,
} from "@/lib/registration-export";
import { canViewOperations } from "@/lib/roles";
import { loadStaffAccessScope, seasonIdAllowed } from "@/lib/staff-access-scope";

function csvCell(s: string) {
  return `"${String(s).replace(/"/g, '""')}"`;
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.role || !canViewOperations(session.user.role)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const url = new URL(req.url);
  const seasonId = url.searchParams.get("season")?.trim() ?? "";
  if (!seasonId) return new Response("Missing season", { status: 400 });

  if (session.user.id) {
    const staffScope = await loadStaffAccessScope(session.user.id);
    if (!seasonIdAllowed(staffScope, seasonId)) {
      return new Response("Forbidden", { status: 403 });
    }
  }

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
      formSubmission: {
        select: {
          registrationCode: true,
          guardianResponses: true,
          stripePaymentStatus: true,
          stripeCheckoutSessionId: true,
        },
      },
    },
  });

  const header = columns.map((k) => optionMap.get(k)?.label ?? k);
  const lines: string[] = [header.map(csvCell).join(",")];

  for (const r of rows) {
    const values = columns.map((k) =>
      resolveRegistrationExportFieldValue(
        {
          id: r.id,
          registrationNumber: r.registrationNumber,
          status: r.status,
          registeredAt: r.registeredAt,
          notes: r.notes,
          customResponses: r.customResponses,
          expectsPayment: r.expectsPayment,
          paymentReceivedAt: r.paymentReceivedAt,
          child: r.child,
          classroom: r.classroom,
          formSubmission: r.formSubmission,
        },
        season.name,
        k,
      ),
    );
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
