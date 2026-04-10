import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import authConfig from "@/auth.config";

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
