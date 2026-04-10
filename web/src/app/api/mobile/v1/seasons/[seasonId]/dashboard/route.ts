import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  loadSeasonOr404,
  requireMobileAuth,
  jsonError,
} from "@/app/api/mobile/v1/_lib/mobile-request";

type RouteParams = { params: Promise<{ seasonId: string }> };

export async function GET(req: NextRequest, { params }: RouteParams) {
  const auth = await requireMobileAuth(req);
  if (auth instanceof NextResponse) return auth;

  const { seasonId } = await params;
  const season = await loadSeasonOr404(seasonId);
  if (!season) return jsonError(404, "Season not found");

  const [totalRegs, checkedIn, classCount, alertRegs, recent] =
    await Promise.all([
      prisma.registration.count({
        where: { seasonId, status: { not: "CANCELLED" } },
      }),
      prisma.registration.count({
        where: {
          seasonId,
          status: { not: "CANCELLED" },
          checkedInAt: { not: null },
        },
      }),
      prisma.classroom.count({
        where: { seasonId, isActive: true },
      }),
      prisma.registration.count({
        where: {
          seasonId,
          status: { not: "CANCELLED" },
          child: {
            allergiesNotes: { not: null },
            NOT: { allergiesNotes: "" },
          },
        },
      }),
      prisma.registration.findMany({
        where: {
          seasonId,
          status: { not: "CANCELLED" },
          checkedInAt: { not: null },
        },
        orderBy: { checkedInAt: "desc" },
        take: 8,
        include: {
          child: { select: { firstName: true, lastName: true } },
          classroom: { select: { name: true } },
        },
      }),
    ]);

  return NextResponse.json({
    season: {
      id: season.id,
      name: season.name,
      year: season.year,
      isActive: season.isActive,
    },
    kpis: {
      checkedIn,
      remainingArrivals: Math.max(0, totalRegs - checkedIn),
      classesActive: classCount,
      studentsWithAlerts: alertRegs,
    },
    recentCheckIns: recent.map((r) => ({
      registrationId: r.id,
      studentName: `${r.child.firstName} ${r.child.lastName}`,
      className: r.classroom?.name ?? null,
      checkedInAt: r.checkedInAt?.toISOString() ?? null,
    })),
  });
}
