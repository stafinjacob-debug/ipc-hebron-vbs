import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import authConfig from "@/auth.config";
import { CANONICAL_PUBLIC_ORIGIN, LEGACY_PUBLIC_HOSTS } from "@/lib/public-app-url";

const { auth } = NextAuth(authConfig);

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/seasons",
  "/registrations",
  "/students",
  "/children",
  "/check-in",
  "/classes",
  "/volunteers",
  "/announcements",
  "/documents",
  "/content",
  "/reports",
  "/settings",
] as const;

export default auth((req) => {
  const host = req.headers.get("host")?.split(":")[0]?.toLowerCase();
  if (host && (LEGACY_PUBLIC_HOSTS as readonly string[]).includes(host)) {
    const destination = new URL(req.nextUrl.pathname + req.nextUrl.search, CANONICAL_PUBLIC_ORIGIN);
    return NextResponse.redirect(destination, 308);
  }

  const { pathname } = req.nextUrl;

  if (pathname === "/registration-forms" || pathname.startsWith("/registration-forms/")) {
    const url = req.nextUrl.clone();
    url.pathname = pathname.replace(/^\/registration-forms/, "/registrations/forms");
    return NextResponse.redirect(url);
  }

  const isLoggedIn = !!req.auth;

  if (!isLoggedIn && PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))) {
    return Response.redirect(new URL("/login", req.nextUrl));
  }

  if (isLoggedIn && pathname === "/login") {
    return Response.redirect(new URL("/dashboard", req.nextUrl));
  }
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|mp4)$).*)",
    "/dashboard/:path*",
    "/seasons/:path*",
    "/registration-forms/:path*",
    "/registrations/:path*",
    "/students/:path*",
    "/children/:path*",
    "/check-in/:path*",
    "/classes",
    "/classes/:path*",
    "/volunteers/:path*",
    "/announcements/:path*",
    "/documents/:path*",
    "/content/:path*",
    "/reports/:path*",
    "/settings/:path*",
    "/login",
  ],
};
