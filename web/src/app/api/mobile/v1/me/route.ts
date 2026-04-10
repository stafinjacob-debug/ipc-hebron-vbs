import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMobileAuth, jsonError } from "@/app/api/mobile/v1/_lib/mobile-request";

export async function GET(req: NextRequest) {
  const auth = await requireMobileAuth(req);
  if (auth instanceof NextResponse) return auth;

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { id: true, email: true, name: true, role: true, status: true },
  });
  if (!user || user.status !== "ACTIVE") {
    return jsonError(401, "User not found or inactive");
  }

  return NextResponse.json({ user });
}
