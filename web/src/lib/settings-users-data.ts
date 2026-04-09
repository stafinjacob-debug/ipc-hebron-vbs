import { Prisma } from "@/generated/prisma";
import type { UserRole, UserStatus } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { normalizeStaffRole } from "@/lib/permissions";
import { ASSIGNABLE_STAFF_ROLES } from "@/lib/roles";

export type SettingsUsersTableRow = {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  status: UserStatus;
  lastLoginAt: Date | null;
  invitedBy: { name: string | null; email: string | null } | null;
  seasonScopes: { season: { name: string; year: number } }[];
  classroomScopes: { classroom: { name: string } }[];
};

export type UserDetailPayload = {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  status: UserStatus;
  lastLoginAt: string | null;
  invitedAt: string | null;
  invitedBy: { name: string | null; email: string | null } | null;
  seasonScopes: { seasonId: string }[];
  classroomScopes: { classroomId: string }[];
};

function isMissingColumnError(e: unknown): boolean {
  return (
    e instanceof Prisma.PrismaClientKnownRequestError &&
    (e.code === "P2022" ||
      (typeof e.message === "string" &&
        (e.message.includes("does not exist") || e.message.includes("Column"))))
  );
}

function legacySyntheticStatus(passwordHash: string | null): UserStatus {
  if (passwordHash) return "ACTIVE";
  return "INVITED";
}

async function legacyListBaseRows(q: string): Promise<
  Array<{
    id: string;
    email: string;
    name: string | null;
    role: string;
    passwordHash: string | null;
    lastLoginAt: Date | null;
  }>
> {
  const pattern = q ? `%${q}%` : null;
  try {
    if (pattern) {
      return await prisma.$queryRaw`
        SELECT id, email, name, role::text AS role, "passwordHash", "lastLoginAt"
        FROM "User"
        WHERE role::text != 'PARENT'
          AND (email ILIKE ${pattern} OR COALESCE(name, '') ILIKE ${pattern})
        ORDER BY COALESCE(name, email) ASC
      `;
    }
    return await prisma.$queryRaw`
      SELECT id, email, name, role::text AS role, "passwordHash", "lastLoginAt"
      FROM "User"
      WHERE role::text != 'PARENT'
      ORDER BY COALESCE(name, email) ASC
    `;
  } catch {
    if (pattern) {
      return await prisma.$queryRaw`
        SELECT id, email, name, role::text AS role, "passwordHash"
        FROM "User"
        WHERE role::text != 'PARENT'
          AND (email ILIKE ${pattern} OR COALESCE(name, '') ILIKE ${pattern})
        ORDER BY COALESCE(name, email) ASC
      `;
    }
    return await prisma.$queryRaw`
      SELECT id, email, name, role::text AS role, "passwordHash"
      FROM "User"
      WHERE role::text != 'PARENT'
      ORDER BY COALESCE(name, email) ASC
    `;
  }
}

export async function fetchUsersForSettingsTable(opts: {
  q: string;
  validRole?: UserRole;
  validStatus?: UserStatus;
}): Promise<{ users: SettingsUsersTableRow[]; legacySchema: boolean }> {
  const { q, validRole, validStatus } = opts;

  try {
    const users = await prisma.user.findMany({
      where: {
        role: { not: "PARENT" },
        AND: [
          q
            ? {
                OR: [
                  { email: { contains: q, mode: "insensitive" } },
                  { name: { contains: q, mode: "insensitive" } },
                ],
              }
            : {},
          validRole ? { role: validRole } : {},
          validStatus ? { status: validStatus } : {},
        ],
      },
      orderBy: [{ status: "asc" }, { name: "asc" }, { email: "asc" }],
      include: {
        invitedBy: { select: { name: true, email: true } },
        seasonScopes: { include: { season: { select: { name: true, year: true } } } },
        classroomScopes: { include: { classroom: { select: { name: true } } } },
      },
    });

    return {
      legacySchema: false,
      users: users.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: normalizeStaffRole(u.role),
        status: u.status,
        lastLoginAt: u.lastLoginAt,
        invitedBy: u.invitedBy,
        seasonScopes: u.seasonScopes.map((s) => ({ season: s.season })),
        classroomScopes: u.classroomScopes.map((c) => ({ classroom: c.classroom })),
      })),
    };
  } catch (e) {
    if (!isMissingColumnError(e)) throw e;

    const base = await legacyListBaseRows(q);
    let mapped: SettingsUsersTableRow[] = base.map((row) => ({
      id: row.id,
      email: row.email,
      name: row.name,
      role: normalizeStaffRole(row.role),
      status: legacySyntheticStatus(row.passwordHash),
      lastLoginAt: row.lastLoginAt ?? null,
      invitedBy: null,
      seasonScopes: [],
      classroomScopes: [],
    }));

    if (validRole && ASSIGNABLE_STAFF_ROLES.includes(validRole)) {
      mapped = mapped.filter((u) => u.role === validRole);
    }
    if (validStatus) {
      mapped = mapped.filter((u) => u.status === validStatus);
    }

    return { users: mapped, legacySchema: true };
  }
}

async function legacyUserById(id: string): Promise<{
  id: string;
  email: string;
  name: string | null;
  role: string;
  passwordHash: string | null;
  lastLoginAt: Date | null;
} | null> {
  try {
    const rows = await prisma.$queryRaw<
      Array<{
        id: string;
        email: string;
        name: string | null;
        role: string;
        passwordHash: string | null;
        lastLoginAt: Date | null;
      }>
    >`
      SELECT id, email, name, role::text AS role, "passwordHash", "lastLoginAt"
      FROM "User"
      WHERE id = ${id}
      LIMIT 1
    `;
    return rows[0] ?? null;
  } catch {
    const rows = await prisma.$queryRaw<
      Array<{
        id: string;
        email: string;
        name: string | null;
        role: string;
        passwordHash: string | null;
      }>
    >`
      SELECT id, email, name, role::text AS role, "passwordHash"
      FROM "User"
      WHERE id = ${id}
      LIMIT 1
    `;
    const row = rows[0];
    if (!row) return null;
    return { ...row, lastLoginAt: null };
  }
}

export async function fetchUserForSettingsDetail(
  id: string,
): Promise<{ payload: UserDetailPayload | null; legacySchema: boolean }> {
  try {
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        invitedBy: { select: { name: true, email: true } },
        seasonScopes: { select: { seasonId: true } },
        classroomScopes: { select: { classroomId: true } },
      },
    });

    if (!user) return { payload: null, legacySchema: false };

    return {
      legacySchema: false,
      payload: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: normalizeStaffRole(user.role),
        status: user.status,
        lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
        invitedAt: user.invitedAt?.toISOString() ?? null,
        invitedBy: user.invitedBy,
        seasonScopes: user.seasonScopes,
        classroomScopes: user.classroomScopes,
      },
    };
  } catch (e) {
    if (!isMissingColumnError(e)) throw e;

    const row = await legacyUserById(id);
    if (!row) return { payload: null, legacySchema: true };

    const role = normalizeStaffRole(row.role);
    return {
      legacySchema: true,
      payload: {
        id: row.id,
        email: row.email,
        name: row.name,
        role,
        status: legacySyntheticStatus(row.passwordHash),
        lastLoginAt: row.lastLoginAt?.toISOString() ?? null,
        invitedAt: null,
        invitedBy: null,
        seasonScopes: [],
        classroomScopes: [],
      },
    };
  }
}

export async function fetchUserMetaForSettings(
  id: string,
): Promise<{ name: string | null; email: string } | null> {
  try {
    const u = await prisma.user.findUnique({
      where: { id },
      select: { name: true, email: true },
    });
    return u;
  } catch (e) {
    if (!isMissingColumnError(e)) throw e;
    const rows = await prisma.$queryRaw<Array<{ name: string | null; email: string }>>`
      SELECT name, email FROM "User" WHERE id = ${id} LIMIT 1
    `;
    return rows[0] ?? null;
  }
}
