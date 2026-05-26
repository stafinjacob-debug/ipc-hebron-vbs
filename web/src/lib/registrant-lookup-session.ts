import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "registrant_lookup_session";
const SESSION_TTL_SEC = 60 * 60; // 1 hour

export type RegistrantLookupSession =
  | { kind: "submission"; submissionId: string; emailNormalized: string }
  | { kind: "registration"; registrationId: string; emailNormalized: string };

function signingSecret(): string | null {
  const s =
    process.env.AUTH_SECRET?.trim() ||
    process.env.NEXTAUTH_SECRET?.trim() ||
    process.env.REGISTRATION_PUBLIC_TOKEN_SECRET?.trim();
  return s || null;
}

function signPayload(payload: string): string | null {
  const secret = signingSecret();
  if (!secret) return null;
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function signRegistrantLookupSession(session: RegistrantLookupSession): string | null {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SEC;
  const payload =
    session.kind === "submission"
      ? `s:${session.submissionId}:${session.emailNormalized}:${exp}`
      : `r:${session.registrationId}:${session.emailNormalized}:${exp}`;
  return signPayload(payload);
}

/** @deprecated Use signRegistrantLookupSession — kept for legacy token minting tests. */
export function signRegistrantLookupSessionLegacy(
  submissionId: string,
  emailNormalized: string,
): string | null {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SEC;
  return signPayload(`${submissionId}:${emailNormalized}:${exp}`);
}

export function verifyRegistrantLookupSessionToken(token: string): RegistrantLookupSession | null {
  const secret = signingSecret();
  if (!secret || !token.trim()) return null;

  const parts = token.trim().split(".");
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expected = createHmac("sha256", secret).update(payload).digest("base64url");
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return null;

  const segs = payload.split(":");
  if (segs.length === 3) {
    const [submissionId, emailNormalized, expStr] = segs;
    const exp = Number.parseInt(expStr, 10);
    if (!submissionId || !emailNormalized || !Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return { kind: "submission", submissionId, emailNormalized };
  }

  if (segs.length === 4) {
    const [kind, id, emailNormalized, expStr] = segs;
    const exp = Number.parseInt(expStr, 10);
    if (!id || !emailNormalized || !Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    if (kind === "s") return { kind: "submission", submissionId: id, emailNormalized };
    if (kind === "r") return { kind: "registration", registrationId: id, emailNormalized };
  }

  return null;
}

export async function setRegistrantLookupSessionCookie(session: RegistrantLookupSession): Promise<boolean> {
  const token = signRegistrantLookupSession(session);
  if (!token) return false;
  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/register",
    maxAge: SESSION_TTL_SEC,
  });
  return true;
}

export async function readRegistrantLookupSession(): Promise<RegistrantLookupSession | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyRegistrantLookupSessionToken(token);
}

export async function clearRegistrantLookupSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete({ name: COOKIE_NAME, path: "/register" });
}
