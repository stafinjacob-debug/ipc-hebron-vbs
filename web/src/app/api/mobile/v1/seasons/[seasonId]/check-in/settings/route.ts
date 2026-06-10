import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveBadgePrintSettings } from "@/lib/badge-print";
import {
  loadSeasonOr404,
  requireMobileAuth,
  jsonError,
  requireCheckInRole,
} from "@/app/api/mobile/v1/_lib/mobile-request";

type RouteParams = { params: Promise<{ seasonId: string }> };

export async function GET(req: NextRequest, { params }: RouteParams) {
  const auth = await requireMobileAuth(req);
  if (auth instanceof NextResponse) return auth;
  const denied = requireCheckInRole(auth);
  if (denied) return denied;

  const { seasonId } = await params;
  const season = await loadSeasonOr404(seasonId);
  if (!season) return jsonError(404, "Season not found");

  const row = await prisma.badgePrintSettings.findUnique({
    where: { seasonId },
  });
  const settings = resolveBadgePrintSettings(row);

  return NextResponse.json({
    badgePrintingEnabled: settings.enabled,
    autoPrintOnCheckIn: settings.enabled && settings.autoPrintOnCheckIn,
  });
}
