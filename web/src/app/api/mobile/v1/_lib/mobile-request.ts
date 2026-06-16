import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  canManageSeasonAnnouncements,
  canPerformMobileCheckIn,
  canViewMobileClassRoster,
  normalizeStaffRole,
} from "@/lib/permissions";
import type { UserRole } from "@/generated/prisma";
import { verifyMobileAccessToken } from "@/lib/mobile-jwt";
import {
  loadStaffAccessScope,
  registrationAllowedByScope,
  seasonIdAllowed,
  type StaffAccessScope,
} from "@/lib/staff-access-scope";

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
  if (!canPerformMobileCheckIn(ctx.role)) {
    return jsonError(403, "Check-in is not available for your role");
  }
  return null;
}

export function requireClassRosterRole(ctx: MobileAuthContext): NextResponse | null {
  if (!canViewMobileClassRoster(ctx.role)) {
    return jsonError(403, "Classes are not available for your role");
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

export type SeasonAccessResult =
  | { ok: true; scope: StaffAccessScope }
  | { ok: false; response: NextResponse };

export async function assertSeasonAccess(
  userId: string,
  seasonId: string,
): Promise<SeasonAccessResult> {
  const scope = await loadStaffAccessScope(userId);
  if (!seasonIdAllowed(scope, seasonId)) {
    return {
      ok: false,
      response: jsonError(403, "You do not have access to this program"),
    };
  }
  return { ok: true, scope };
}

export function registrationDeniedByScope(
  scope: StaffAccessScope,
  reg: { seasonId: string; classroomId: string | null },
): NextResponse | null {
  if (!registrationAllowedByScope(scope, reg)) {
    return jsonError(403, "You do not have access to this registration");
  }
  return null;
}
