import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "registrant_lookup_session";
const SESSION_TTL_SEC = 60 * 60; // 1 hour

function signingSecret(): string | null {
  const s =
    process.env.AUTH_SECRET?.trim() ||
    process.env.NEXTAUTH_SECRET?.trim() ||
    process.env.REGISTRATION_PUBLIC_TOKEN_SECRET?.trim();
  return s || null;
}

export function signRegistrantLookupSession(submissionId: string, emailNormalized: string): string | null {
  const secret = signingSecret();
  if (!secret) return null;
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SEC;
  const payload = `${submissionId}:${emailNormalized}:${exp}`;
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyRegistrantLookupSessionToken(
  token: string,
): { submissionId: string; emailNormalized: string } | null {
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
  if (segs.length !== 3) return null;
  const [submissionId, emailNormalized, expStr] = segs;
  const exp = Number.parseInt(expStr, 10);
  if (!submissionId || !emailNormalized || !Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) {
    return null;
  }

  return { submissionId, emailNormalized };
}

export async function setRegistrantLookupSessionCookie(submissionId: string, emailNormalized: string): Promise<boolean> {
  const token = signRegistrantLookupSession(submissionId, emailNormalized);
  if (!token) return false;
  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/register/lookup",
    maxAge: SESSION_TTL_SEC,
  });
  return true;
}

export async function readRegistrantLookupSession(): Promise<{
  submissionId: string;
  emailNormalized: string;
} | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyRegistrantLookupSessionToken(token);
}

export async function clearRegistrantLookupSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}
