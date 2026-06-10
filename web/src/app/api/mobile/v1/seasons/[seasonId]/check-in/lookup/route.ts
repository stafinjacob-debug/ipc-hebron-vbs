import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  loadSeasonOr404,
  requireMobileAuth,
  jsonError,
  requireCheckInRole,
} from "@/app/api/mobile/v1/_lib/mobile-request";
import { parseCheckInLookupInput } from "@/lib/check-in-lookup";

type RouteParams = { params: Promise<{ seasonId: string }> };

function mapMatch(r: {
  id: string;
  status: string;
  checkedInAt: Date | null;
  registrationNumber: string | null;
  child: {
    firstName: string;
    lastName: string;
    dateOfBirth: Date;
    allergiesNotes: string | null;
    guardian: { firstName: string; lastName: string };
  };
  classroom: { name: string } | null;
  formSubmission: { registrationCode: string } | null;
}) {
  const guardian = r.child.guardian;
  return {
    id: r.id,
    studentName: `${r.child.firstName} ${r.child.lastName}`.trim(),
    className: r.classroom?.name ?? "—",
    checkedIn: Boolean(r.checkedInAt),
    registrationNumber: r.registrationNumber,
    submissionCode: r.formSubmission?.registrationCode ?? null,
    guardianName: `${guardian.firstName} ${guardian.lastName}`.trim() || null,
    dateOfBirth: r.child.dateOfBirth.toLocaleDateString("en-US", {
      month: "numeric",
      day: "numeric",
      year: "numeric",
    }),
    allergiesNotes: r.child.allergiesNotes?.trim() || null,
    registrationStatus: r.status,
  };
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const auth = await requireMobileAuth(req);
  if (auth instanceof NextResponse) return auth;
  const denied = requireCheckInRole(auth);
  if (denied) return denied;

  const { seasonId } = await params;
  const season = await loadSeasonOr404(seasonId);
  if (!season) return jsonError(404, "Season not found");

  let body: { input?: string };
  try {
    body = (await req.json()) as { input?: string };
  } catch {
    return jsonError(400, "Invalid JSON");
  }

  const rawInput = typeof body.input === "string" ? body.input : "";
  const parsed = parseCheckInLookupInput(rawInput);
  if (!parsed.checkInToken && !parsed.plainCode) {
    return jsonError(400, "Enter a registration code or scan a check-in QR code.");
  }

  const baseWhere = {
    seasonId,
    status: { not: "CANCELLED" as const },
  };

  const include = {
    child: { include: { guardian: true } },
    classroom: true,
    formSubmission: { select: { registrationCode: true } },
  } as const;

  if (parsed.checkInToken) {
    const reg = await prisma.registration.findFirst({
      where: { ...baseWhere, checkInToken: parsed.checkInToken },
      include,
    });
    if (!reg) {
      return jsonError(404, "No registration found for that QR code in the active season.");
    }
    return NextResponse.json({ matches: [mapMatch(reg)] });
  }

  const code = parsed.plainCode!;
  const byNumber = await prisma.registration.findMany({
    where: {
      ...baseWhere,
      registrationNumber: { equals: code, mode: "insensitive" },
    },
    include,
    orderBy: [{ child: { lastName: "asc" } }, { child: { firstName: "asc" } }],
  });
  if (byNumber.length > 0) {
    return NextResponse.json({ matches: byNumber.map(mapMatch) });
  }

  const bySubmission = await prisma.registration.findMany({
    where: {
      ...baseWhere,
      formSubmission: { registrationCode: { equals: code, mode: "insensitive" } },
    },
    include,
    orderBy: [{ child: { lastName: "asc" } }, { child: { firstName: "asc" } }],
  });
  if (bySubmission.length > 0) {
    return NextResponse.json({ matches: bySubmission.map(mapMatch) });
  }

  return jsonError(
    404,
    `No registration found for “${code}” in ${season.name}. Try the child’s registration number or family submission code.`,
  );
}
