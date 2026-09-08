import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { CSV_UTF8_BOM } from "@/lib/registration-export";
import { registrationListPaymentBadge } from "@/lib/registration-list-payment";
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
      // One CSV row per child — do not collapse siblings onto the submission.
      registrations: {
        orderBy: { registeredAt: "asc" },
        include: { child: true },
      },
    },
  });

  const header = [
    "registrationId",
    "registrationNumber",
    "childIndex",
    "submissionCode",
    "submittedAt",
    "guardianFirstName",
    "guardianLastName",
    "guardianEmail",
    "guardianPhone",
    "childFirstName",
    "childLastName",
    "childDob",
    "registrationStatus",
    "paymentStatus",
    "staffNotes",
    "guardianResponsesJson",
  ];

  const lines: string[] = [header.map(csvCell).join(",")];
  let dataRowCount = 0;

  for (const s of rows) {
    const g = s.guardian;
    const responses = JSON.stringify(s.guardianResponses ?? {});
    if (s.registrations.length === 0) {
      dataRowCount += 1;
      lines.push(
        [
          csvCell(""),
          csvCell(""),
          csvCell(""),
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
          csvCell(""),
          csvCell(responses),
        ].join(","),
      );
      continue;
    }
    s.registrations.forEach((r, idx) => {
      dataRowCount += 1;
      const paymentStatus = registrationListPaymentBadge({
        paymentReceivedAt: r.paymentReceivedAt,
        expectsPayment: r.expectsPayment,
        formSubmission: {
          stripePaymentStatus: s.stripePaymentStatus,
          stripeCheckoutSessionId: s.stripeCheckoutSessionId,
        },
      }).label;
      lines.push(
        [
          csvCell(r.id),
          csvCell(r.registrationNumber ?? ""),
          csvCell(String(idx + 1)),
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
          csvCell(paymentStatus),
          csvCell(r.notes ?? ""),
          csvCell(responses),
        ].join(","),
      );
    });
  }

  const csv = `${CSV_UTF8_BOM}${lines.join("\n")}`;
  const filename = `vbs-submission-children-${season.year}-${dataRowCount}rows-${seasonId.slice(0, 8)}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
