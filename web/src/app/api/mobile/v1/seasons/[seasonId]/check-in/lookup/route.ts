import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { loadSeasonAttendanceContext, resolveCheckedInMap } from "@/lib/attendance";
import {
  findCheckInRegistrationsForInput,
  mapRegistrationToCheckInLookupMatch,
  parseCheckInLookupInput,
} from "@/lib/check-in-lookup";
import {
  loadSeasonOr404,
  requireMobileAuth,
  jsonError,
  requireCheckInRole,
} from "@/app/api/mobile/v1/_lib/mobile-request";

type RouteParams = { params: Promise<{ seasonId: string }> };

export async function POST(req: NextRequest, { params }: RouteParams) {
  const auth = await requireMobileAuth(req);
  if (auth instanceof NextResponse) return auth;
  const denied = requireCheckInRole(auth);
  if (denied) return denied;

  const { seasonId } = await params;
  const season = await loadSeasonOr404(seasonId);
  if (!season) return jsonError(404, "Season not found");

  let body: { input?: string; campDate?: string };
  try {
    body = (await req.json()) as { input?: string; campDate?: string };
  } catch {
    return jsonError(400, "Invalid JSON");
  }

  const rawInput = typeof body.input === "string" ? body.input : "";
  const parsed = parseCheckInLookupInput(rawInput);
  if (!parsed.checkInToken && !parsed.plainCode) {
    return jsonError(400, "Enter a name, registration code, or scan a check-in QR code.");
  }

  const rows = await findCheckInRegistrationsForInput(seasonId, rawInput);
  if (rows.length === 0) {
    const label = parsed.plainCode ?? "that code";
    return jsonError(
      404,
      `No registration found for “${label}” in ${season.name}. Try the child’s full name, registration number, or family submission code.`,
    );
  }

  const seasonRow = await prisma.vbsSeason.findUnique({
    where: { id: seasonId },
    select: { multiDayCheckInEnabled: true },
  });
  const context = await loadSeasonAttendanceContext(seasonId, body.campDate);
  const campDate = context?.defaultCampDate ?? "";
  const checkedInMap = await resolveCheckedInMap(
    rows.map((r) => r.id),
    campDate,
    seasonRow?.multiDayCheckInEnabled ?? false,
  );

  return NextResponse.json({
    matches: rows.map((r) =>
      mapRegistrationToCheckInLookupMatch(r, checkedInMap.get(r.id) ?? false),
    ),
  });
}
