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
import type { VbsAnnouncement } from "@/generated/prisma";

type RouteParams = { params: Promise<{ seasonId: string }> };

const audienceValues = ["STAFF", "VOLUNTEERS", "ALL"] as const;

const createBodySchema = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(20_000),
  audience: z.enum(audienceValues).optional(),
  pinned: z.boolean().optional(),
});

export function announcementToJson(a: VbsAnnouncement) {
  return {
    id: a.id,
    title: a.title,
    body: a.body,
    audience: a.audience,
    pinned: a.pinned,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
    createdByUserId: a.createdByUserId,
  };
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const auth = await requireMobileAuth(req);
  if (auth instanceof NextResponse) return auth;

  const { seasonId } = await params;
  const season = await loadSeasonOr404(seasonId);
  if (!season) return jsonError(404, "Season not found");

  const rows = await prisma.vbsAnnouncement.findMany({
    where: { seasonId },
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
  });

  return NextResponse.json({
    announcements: rows.map(announcementToJson),
  });
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const auth = await requireMobileAuth(req);
  if (auth instanceof NextResponse) return auth;
  const denied = requireAnnouncementsManager(auth);
  if (denied) return denied;

  const { seasonId } = await params;
  const season = await loadSeasonOr404(seasonId);
  if (!season) return jsonError(404, "Season not found");

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonError(400, "Invalid JSON");
  }

  const parsed = createBodySchema.safeParse(raw);
  if (!parsed.success) {
    return jsonError(400, "Invalid announcement body");
  }

  const { title, body, audience, pinned } = parsed.data;

  const created = await prisma.vbsAnnouncement.create({
    data: {
      seasonId,
      title,
      body,
      audience: audience ?? "STAFF",
      pinned: pinned ?? false,
      createdByUserId: auth.userId,
    },
  });

  await prisma.staffAccessAuditLog
    .create({
      data: {
        action: "MOBILE_ANNOUNCEMENT_CREATE",
        actorUserId: auth.userId,
        metadata: { announcementId: created.id, seasonId },
      },
    })
    .catch(() => {});

  return NextResponse.json({ announcement: announcementToJson(created) });
}
