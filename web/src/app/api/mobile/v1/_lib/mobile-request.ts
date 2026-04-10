import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  canManageSeasonAnnouncements,
  canUseCheckInActions,
  normalizeStaffRole,
} from "@/lib/permissions";
import type { UserRole } from "@/generated/prisma";
import { verifyMobileAccessToken } from "@/lib/mobile-jwt";

export type MobileAuthContext = {
  userId: string;
  email: string;
  role: UserRole;
};

export function jsonError(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

export async function requireMobileAuth(
  req: NextRequest,
): Promise<MobileAuthContext | NextResponse> {
  const header = req.headers.get("authorization");
  const token =
    header?.startsWith("Bearer ") ? header.slice(7).trim() : null;
  if (!token) {
    return jsonError(401, "Missing bearer token");
  }
  const payload = await verifyMobileAccessToken(token);
  if (!payload?.sub || !payload.role) {
    return jsonError(401, "Invalid or expired token");
  }
  const role = normalizeStaffRole(payload.role) as UserRole;
  if (role === "PARENT") {
    return jsonError(403, "This app is for staff and volunteers only");
  }
  const email = payload.email ?? "";
  return { userId: payload.sub, email, role };
}

export function requireCheckInRole(ctx: MobileAuthContext): NextResponse | null {
  if (!canUseCheckInActions(ctx.role)) {
    return jsonError(403, "Check-in is not available for your role");
  }
  return null;
}

export function requireAnnouncementsManager(
  ctx: MobileAuthContext,
): NextResponse | null {
  if (!canManageSeasonAnnouncements(ctx.role)) {
    return jsonError(403, "You cannot manage announcements");
  }
  return null;
}

export async function loadSeasonOr404(seasonId: string) {
  return prisma.vbsSeason.findUnique({ where: { id: seasonId } });
}
