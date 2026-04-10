import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  loadSeasonOr404,
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

  let body: { checkedIn?: boolean };
  try {
    body = (await req.json()) as { checkedIn?: boolean };
  } catch {
    return jsonError(400, "Invalid JSON");
  }
  if (typeof body.checkedIn !== "boolean") {
    return jsonError(400, "checkedIn boolean required");
  }

  const { seasonId, registrationId } = await params;
  const season = await loadSeasonOr404(seasonId);
  if (!season) return jsonError(404, "Season not found");

  const existing = await prisma.registration.findFirst({
    where: { id: registrationId, seasonId, status: { not: "CANCELLED" } },
    select: { id: true, checkedInAt: true },
  });
  if (!existing) return jsonError(404, "Registration not found");

  if (body.checkedIn) {
    if (existing.checkedInAt) {
      return NextResponse.json({
        ok: true,
        alreadyCheckedIn: true,
        checkedInAt: existing.checkedInAt.toISOString(),
      });
    }
    const updated = await prisma.registration.update({
      where: { id: registrationId },
      data: { checkedInAt: new Date() },
      select: { checkedInAt: true },
    });
    await prisma.staffAccessAuditLog
      .create({
        data: {
          action: "MOBILE_CHECK_IN",
          actorUserId: auth.userId,
          metadata: { registrationId, seasonId },
        },
      })
      .catch(() => {});
    return NextResponse.json({
      ok: true,
      checkedInAt: updated.checkedInAt?.toISOString() ?? null,
    });
  }

  if (!existing.checkedInAt) {
    return NextResponse.json({
      ok: true,
      alreadyCheckedOut: true,
    });
  }
  await prisma.registration.update({
    where: { id: registrationId },
    data: { checkedInAt: null },
  });
  await prisma.staffAccessAuditLog
    .create({
      data: {
        action: "MOBILE_CHECK_OUT",
        actorUserId: auth.userId,
        metadata: { registrationId, seasonId },
      },
    })
    .catch(() => {});

  return NextResponse.json({ ok: true, checkedOut: true });
}
