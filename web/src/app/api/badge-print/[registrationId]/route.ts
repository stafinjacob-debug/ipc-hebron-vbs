import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  buildBadgePrintPayload,
  resolveBadgePrintSettings,
} from "@/lib/badge-print";
import { canUseCheckInActions, canViewOperations } from "@/lib/roles";
import { registrationTicketUrl } from "@/lib/registration-identity";
import { getPublicAppBaseUrl } from "@/lib/public-app-url";
import QRCode from "qrcode";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ registrationId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.role) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = session.user.role;
  if (!canViewOperations(role) && !canUseCheckInActions(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { registrationId } = await context.params;
  const reg = await prisma.registration.findUnique({
    where: { id: registrationId },
    include: {
      child: true,
      season: { include: { badgePrintSettings: true } },
      classroom: true,
    },
  });

  if (!reg) {
    return NextResponse.json({ error: "Registration not found" }, { status: 404 });
  }

  const settings = resolveBadgePrintSettings(reg.season.badgePrintSettings);
  if (!settings.enabled) {
    return NextResponse.json({ error: "Badge printing is disabled for this season." }, { status: 403 });
  }

  let qrDataUrl: string | null = null;
  if (settings.showQrCode && reg.checkInToken) {
    const ticketUrl = registrationTicketUrl(reg.checkInToken, getPublicAppBaseUrl());
    qrDataUrl = await QRCode.toDataURL(ticketUrl, {
      width: 240,
      margin: 1,
      color: { dark: "#0f172a", light: "#ffffff" },
    });
  }

  const payload = buildBadgePrintPayload({
    settings,
    registrationId: reg.id,
    childFirstName: reg.child.firstName,
    childLastName: reg.child.lastName,
    allergiesNotes: reg.child.allergiesNotes,
    registrationNumber: reg.registrationNumber,
    checkInToken: reg.checkInToken,
    seasonName: reg.season.name,
    seasonYear: reg.season.year,
    classroomName: reg.classroom?.name ?? null,
    badgeDisplayName: reg.classroom?.badgeDisplayName ?? null,
    checkInLabel: reg.classroom?.checkInLabel ?? null,
    qrDataUrl,
  });

  return NextResponse.json(payload);
}
