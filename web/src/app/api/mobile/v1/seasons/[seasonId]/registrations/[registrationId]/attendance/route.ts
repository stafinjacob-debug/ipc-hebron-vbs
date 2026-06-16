import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveBadgePrintSettings } from "@/lib/badge-print";
import { setRegistrationAttendance } from "@/lib/attendance";
import {
  assertSeasonAccess,
  loadSeasonOr404,
  registrationDeniedByScope,
  requireMobileAuth,
  jsonError,
  requireCheckInRole,
} from "@/app/api/mobile/v1/_lib/mobile-request";

type RouteParams = {
  params: Promise<{ seasonId: string; registrationId: string }>;
};

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const auth = await requireMobileAuth(req);
  if (auth instanceof NextResponse) return auth;
  const denied = requireCheckInRole(auth);
  if (denied) return denied;

  let body: { checkedIn?: boolean; campDate?: string; undoPin?: string; dismissalCheckout?: boolean };
  try {
    body = (await req.json()) as {
      checkedIn?: boolean;
      campDate?: string;
      undoPin?: string;
      dismissalCheckout?: boolean;
    };
  } catch {
    return jsonError(400, "Invalid JSON");
  }
  if (typeof body.checkedIn !== "boolean") {
    return jsonError(400, "checkedIn boolean required");
  }

  const { seasonId, registrationId } = await params;
  const access = await assertSeasonAccess(auth.userId, seasonId);
  if (!access.ok) return access.response;

  const season = await loadSeasonOr404(seasonId);
  if (!season) return jsonError(404, "Season not found");

  const regRow = await prisma.registration.findFirst({
    where: { id: registrationId, seasonId },
    select: { seasonId: true, classroomId: true },
  });
  if (!regRow) return jsonError(404, "Registration not found");
  const scopeDenied = registrationDeniedByScope(access.scope, regRow);
  if (scopeDenied) return scopeDenied;

  const badgeSettings = await prisma.badgePrintSettings.findUnique({
    where: { seasonId },
  });
  const resolvedBadge = resolveBadgePrintSettings(badgeSettings);

  const result = await setRegistrationAttendance({
    registrationId,
    seasonId,
    checkedIn: body.checkedIn,
    campDateKey: body.campDate,
    actorUserId: auth.userId,
    undoPin: body.undoPin,
    dismissalCheckout: body.dismissalCheckout,
  });

  if (!result.ok) {
    return jsonError(400, result.message);
  }

  if (body.checkedIn) {
    if (result.alreadyCheckedIn) {
      return NextResponse.json({
        ok: true,
        alreadyCheckedIn: true,
        checkedInAt: result.checkedInAt,
        shouldPrintBadge: false,
      });
    }

    await prisma.staffAccessAuditLog
      .create({
        data: {
          action: "MOBILE_CHECK_IN",
          actorUserId: auth.userId,
          metadata: { registrationId, seasonId, campDate: body.campDate ?? null },
        },
      })
      .catch(() => {});

    return NextResponse.json({
      ok: true,
      checkedInAt: result.checkedInAt,
      shouldPrintBadge: resolvedBadge.enabled && resolvedBadge.autoPrintOnCheckIn,
    });
  }

  if (result.alreadyCheckedOut) {
    return NextResponse.json({
      ok: true,
      alreadyCheckedOut: true,
      shouldPrintBadge: false,
    });
  }

  await prisma.staffAccessAuditLog
    .create({
      data: {
        action: "MOBILE_CHECK_OUT",
        actorUserId: auth.userId,
        metadata: { registrationId, seasonId, campDate: body.campDate ?? null },
      },
    })
    .catch(() => {});

  return NextResponse.json({ ok: true, checkedOut: true, shouldPrintBadge: false });
}
