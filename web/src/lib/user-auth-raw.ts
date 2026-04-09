import { prisma } from "@/lib/prisma";

/**
 * Read `User` with `role::text` so legacy PostgreSQL enum values (ADMIN, COORDINATOR, …)
 * do not crash Prisma's decoder (client expects SUPER_ADMIN, CHURCH_ADMIN, …).
 *
 * After `npx prisma migrate deploy` (migration `20250409140000_user_roles_access`), the DB
 * enum matches the client and you can use `prisma.user` normally again.
 */
export type RawAuthUserRow = {
  id: string;
  email: string;
  name: string | null;
  passwordHash: string | null;
  role: string;
  status: string | null;
};

export async function findUserRawByEmail(email: string): Promise<RawAuthUserRow | null> {
  const normalized = email.toLowerCase();
  try {
    const rows = await prisma.$queryRaw<RawAuthUserRow[]>`
      SELECT id, email, name, "passwordHash", role::text AS role, status::text AS status
      FROM "User"
      WHERE email = ${normalized}
      LIMIT 1
    `;
    return rows[0] ?? null;
  } catch {
    const rows = await prisma.$queryRaw<
      Array<{
        id: string;
        email: string;
        name: string | null;
        passwordHash: string | null;
        role: string;
      }>
    >`
      SELECT id, email, name, "passwordHash", role::text AS role
      FROM "User"
      WHERE email = ${normalized}
      LIMIT 1
    `;
    const row = rows[0];
    if (!row) return null;
    return { ...row, status: "ACTIVE" };
  }
}

export async function findUserRawById(id: string): Promise<Pick<RawAuthUserRow, "role" | "name"> | null> {
  try {
    const rows = await prisma.$queryRaw<Array<{ role: string; name: string | null }>>`
      SELECT role::text AS role, name
      FROM "User"
      WHERE id = ${id}
      LIMIT 1
    `;
    return rows[0] ?? null;
  } catch {
    return null;
  }
}
