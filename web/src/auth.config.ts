import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe auth options (no Prisma, bcrypt, or other Node-only modules).
 * Used by middleware. Session/JWT callbacks must match `auth.ts` for the same session shape.
 */
export default {
  trustHost: true,
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 7 },
  pages: { signIn: "/login" },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.id && token.role) {
        session.user.id = token.id as string;
        session.user.role = token.role as (typeof session.user)["role"];
      }
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
