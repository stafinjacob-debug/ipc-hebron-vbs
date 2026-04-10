import { SignJWT, jwtVerify } from "jose";

const MOBILE_AUDIENCE = "vbs-mobile";

function getSecret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 8) {
    throw new Error("AUTH_SECRET is not configured");
  }
  return new TextEncoder().encode(s);
}

export async function signMobileAccessToken(payload: {
  sub: string;
  email: string;
  role: string;
}): Promise<string> {
  const secret = getSecret();
  return new SignJWT({ email: payload.email, role: payload.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime("7d")
    .setAudience(MOBILE_AUDIENCE)
    .sign(secret);
}

export type MobileJwtPayload = {
  sub: string;
  email?: string;
  role?: string;
};

export async function verifyMobileAccessToken(
  token: string,
): Promise<MobileJwtPayload | null> {
  try {
    const secret = getSecret();
    const { payload } = await jwtVerify(token, secret, {
      audience: MOBILE_AUDIENCE,
      algorithms: ["HS256"],
    });
    const sub = typeof payload.sub === "string" ? payload.sub : null;
    if (!sub) return null;
    return {
      sub,
      email: typeof payload.email === "string" ? payload.email : undefined,
      role: typeof payload.role === "string" ? payload.role : undefined,
    };
  } catch {
    return null;
  }
}
