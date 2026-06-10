import { auth } from "@/auth";
import { loadBadgePrintPayloadForRegistration } from "@/lib/badge-print-load";
import { canUseCheckInActions } from "@/lib/permissions";
import { canViewOperations } from "@/lib/roles";
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
  const loaded = await loadBadgePrintPayloadForRegistration(registrationId);
  if (!loaded.ok) {
    return NextResponse.json({ error: loaded.error }, { status: loaded.status });
  }

  return NextResponse.json(loaded.payload);
}
