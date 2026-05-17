import { createHmac, timingSafeEqual } from "node:crypto";

export type SubmissionPublicAction = "cancel" | "pay";

function signingSecret(): string | null {
  const s =
    process.env.AUTH_SECRET?.trim() ||
    process.env.NEXTAUTH_SECRET?.trim() ||
    process.env.REGISTRATION_PUBLIC_TOKEN_SECRET?.trim();
  return s || null;
}

/** Signed token for guardian self-service (e.g. cancel) without login. */
export function signSubmissionPublicToken(
  submissionId: string,
  action: SubmissionPublicAction,
  ttlDays = 45,
): string | null {
  const secret = signingSecret();
  if (!secret) return null;
  const exp = Math.floor(Date.now() / 1000) + ttlDays * 86_400;
  const payload = `${action}:${submissionId}:${exp}`;
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifySubmissionPublicToken(
  token: string,
  action: SubmissionPublicAction,
): { submissionId: string } | null {
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
  const [act, submissionId, expStr] = segs;
  if (act !== action || !submissionId) return null;
  const exp = Number.parseInt(expStr, 10);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return null;

  return { submissionId };
}

export function submissionCancelUrl(token: string, baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, "")}/register/cancel?token=${encodeURIComponent(token)}`;
}

export function submissionPayUrl(token: string, baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, "")}/register/pay?token=${encodeURIComponent(token)}`;
}
