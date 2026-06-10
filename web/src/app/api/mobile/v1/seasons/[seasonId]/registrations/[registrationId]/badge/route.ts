import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { buildBadgePrintHtml } from "@/lib/badge-print-document";
import { renderBadgePngBuffer } from "@/lib/badge-print-image";
import { loadBadgePrintPayloadForRegistration } from "@/lib/badge-print-load";
import {
  loadSeasonOr404,
  requireMobileAuth,
  jsonError,
  requireCheckInRole,
} from "@/app/api/mobile/v1/_lib/mobile-request";
import { prisma } from "@/lib/prisma";

type RouteParams = {
  params: Promise<{ seasonId: string; registrationId: string }>;
};

export async function GET(req: NextRequest, { params }: RouteParams) {
  const auth = await requireMobileAuth(req);
  if (auth instanceof NextResponse) return auth;
  const denied = requireCheckInRole(auth);
  if (denied) return denied;

  const { seasonId, registrationId } = await params;
  const season = await loadSeasonOr404(seasonId);
  if (!season) return jsonError(404, "Season not found");

  const reg = await prisma.registration.findFirst({
    where: { id: registrationId, seasonId, status: { not: "CANCELLED" } },
    select: { id: true },
  });
  if (!reg) return jsonError(404, "Registration not found");

  const loaded = await loadBadgePrintPayloadForRegistration(registrationId);
  if (!loaded.ok) {
    return jsonError(loaded.status, loaded.error);
  }

  const format = req.nextUrl.searchParams.get("format");
  if (format === "png") {
    const png = await renderBadgePngBuffer(loaded.payload);
    return new NextResponse(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store",
      },
    });
  }

  return NextResponse.json({
    html: buildBadgePrintHtml(loaded.payload),
    childName: loaded.payload.childName,
  });
}
