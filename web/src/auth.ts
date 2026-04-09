import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { z } from "zod";
import authConfig from "@/auth.config";
import { normalizeStaffRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { findUserRawByEmail, findUserRawById } from "@/lib/user-auth-raw";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    jwt: async ({ token, user }) => {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      } else if (token.id) {
        const row = await findUserRawById(token.id as string);
        if (row?.role) token.role = normalizeStaffRole(row.role);
      }
      return token;
    },
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (raw) => {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;
        const row = await findUserRawByEmail(email);
        if (!row) return null;

        const status = row.status ?? "ACTIVE";
        if (status !== "ACTIVE") return null;
        if (!row.passwordHash) return null;

        const ok = await compare(password, row.passwordHash);
        if (!ok) {
          await prisma.staffAccessAuditLog
            .create({
              data: {
                action: "LOGIN_FAILED",
                targetUserId: row.id,
                metadata: { email: row.email },
              },
            })
            .catch(() => {});
          return null;
        }

        await prisma.$executeRaw`
          UPDATE "User" SET "lastLoginAt" = ${new Date()} WHERE id = ${row.id}
        `.catch(() => {});

        const role = normalizeStaffRole(row.role);

        return {
          id: row.id,
          email: row.email,
          name: row.name ?? undefined,
          role,
        };
      },
    }),
  ],
});
