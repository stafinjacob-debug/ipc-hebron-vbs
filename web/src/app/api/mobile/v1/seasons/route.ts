import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMobileAuth } from "@/app/api/mobile/v1/_lib/mobile-request";

export async function GET(req: NextRequest) {
  const auth = await requireMobileAuth(req);
  if (auth instanceof NextResponse) return auth;

  const seasons = await prisma.vbsSeason.findMany({
    orderBy: [{ year: "desc" }, { startDate: "desc" }],
    select: {
      id: true,
      name: true,
      year: true,
      theme: true,
      startDate: true,
      endDate: true,
      isActive: true,
    },
  });

  return NextResponse.json({ seasons });
}
