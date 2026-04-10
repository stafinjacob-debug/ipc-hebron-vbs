import { compare } from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeStaffRole } from "@/lib/permissions";
import { signMobileAccessToken } from "@/lib/mobile-jwt";
import { findUserRawByEmail } from "@/lib/user-auth-raw";
import type { UserRole } from "@/generated/prisma";

export async function POST(req: Request) {
  let body: { email?: string; password?: string };
  try {
    body = (await req.json()) as { email?: string; password?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required" },
      { status: 400 },
    );
  }

  const row = await findUserRawByEmail(email);
  if (!row?.passwordHash) {
    return NextResponse.json(
      { error: "Invalid email or password" },
      { status: 401 },
    );
  }

  const status = row.status ?? "ACTIVE";
  if (status !== "ACTIVE") {
    return NextResponse.json(
      { error: "Account is not active" },
      { status: 403 },
    );
  }

  const ok = await compare(password, row.passwordHash);
  if (!ok) {
    await prisma.staffAccessAuditLog
      .create({
        data: {
          action: "MOBILE_LOGIN_FAILED",
          targetUserId: row.id,
          metadata: { email: row.email },
        },
      })
      .catch(() => {});
    return NextResponse.json(
      { error: "Invalid email or password" },
      { status: 401 },
    );
  }

  await prisma.$executeRaw`
    UPDATE "User" SET "lastLoginAt" = ${new Date()} WHERE id = ${row.id}
  `.catch(() => {});

  const role = normalizeStaffRole(row.role) as UserRole;
  if (role === "PARENT") {
    return NextResponse.json(
      { error: "Use the family portal for parent accounts" },
      { status: 403 },
    );
  }

  let accessToken: string;
  try {
    accessToken = await signMobileAccessToken({
      sub: row.id,
      email: row.email,
      role,
    });
  } catch {
    return NextResponse.json(
      { error: "Server auth configuration error" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    accessToken,
    user: {
      id: row.id,
      email: row.email,
      name: row.name,
      role,
    },
  });
}
