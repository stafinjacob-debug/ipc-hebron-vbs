import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  loadSeasonOr404,
  requireMobileAuth,
  jsonError,
  requireAnnouncementsManager,
} from "@/app/api/mobile/v1/_lib/mobile-request";
import { announcementToJson } from "@/app/api/mobile/v1/seasons/[seasonId]/announcements/route";

type RouteParams = {
  params: Promise<{ seasonId: string; announcementId: string }>;
};

const audienceValues = ["STAFF", "VOLUNTEERS", "ALL"] as const;

const patchBodySchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    body: z.string().trim().min(1).max(20_000).optional(),
    audience: z.enum(audienceValues).optional(),
    pinned: z.boolean().optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: "No fields to update" });

export async function GET(req: NextRequest, { params }: RouteParams) {
  const auth = await requireMobileAuth(req);
  if (auth instanceof NextResponse) return auth;

  const { seasonId, announcementId } = await params;
  const season = await loadSeasonOr404(seasonId);
  if (!season) return jsonError(404, "Season not found");

  const row = await prisma.vbsAnnouncement.findFirst({
    where: { id: announcementId, seasonId },
  });
  if (!row) return jsonError(404, "Announcement not found");

  return NextResponse.json({ announcement: announcementToJson(row) });
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const auth = await requireMobileAuth(req);
  if (auth instanceof NextResponse) return auth;
  const denied = requireAnnouncementsManager(auth);
  if (denied) return denied;

  const { seasonId, announcementId } = await params;
  const season = await loadSeasonOr404(seasonId);
  if (!season) return jsonError(404, "Season not found");

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonError(400, "Invalid JSON");
  }

  const parsed = patchBodySchema.safeParse(raw);
  if (!parsed.success) {
    return jsonError(400, "Invalid update body");
  }

  const existing = await prisma.vbsAnnouncement.findFirst({
    where: { id: announcementId, seasonId },
  });
  if (!existing) return jsonError(404, "Announcement not found");

  const updated = await prisma.vbsAnnouncement.update({
    where: { id: announcementId },
    data: parsed.data,
  });

  await prisma.staffAccessAuditLog
    .create({
      data: {
        action: "MOBILE_ANNOUNCEMENT_UPDATE",
        actorUserId: auth.userId,
        metadata: { announcementId, seasonId },
      },
    })
    .catch(() => {});

  return NextResponse.json({ announcement: announcementToJson(updated) });
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const auth = await requireMobileAuth(req);
  if (auth instanceof NextResponse) return auth;
  const denied = requireAnnouncementsManager(auth);
  if (denied) return denied;

  const { seasonId, announcementId } = await params;
  const season = await loadSeasonOr404(seasonId);
  if (!season) return jsonError(404, "Season not found");

  const existing = await prisma.vbsAnnouncement.findFirst({
    where: { id: announcementId, seasonId },
  });
  if (!existing) return jsonError(404, "Announcement not found");

  await prisma.vbsAnnouncement.delete({ where: { id: announcementId } });

  await prisma.staffAccessAuditLog
    .create({
      data: {
        action: "MOBILE_ANNOUNCEMENT_DELETE",
        actorUserId: auth.userId,
        metadata: { announcementId, seasonId },
      },
    })
    .catch(() => {});

  return NextResponse.json({ ok: true });
}
