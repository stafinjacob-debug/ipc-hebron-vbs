import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { CANONICAL_PUBLIC_ORIGIN, LEGACY_PUBLIC_HOSTS } from "@/lib/public-app-url";

export function middleware(request: NextRequest) {
  const host = request.headers.get("host")?.split(":")[0]?.toLowerCase();
  if (!host || !(LEGACY_PUBLIC_HOSTS as readonly string[]).includes(host)) {
    return NextResponse.next();
  }

  const destination = new URL(request.nextUrl.pathname + request.nextUrl.search, CANONICAL_PUBLIC_ORIGIN);
  return NextResponse.redirect(destination, 308);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|mp4)$).*)"],
};
