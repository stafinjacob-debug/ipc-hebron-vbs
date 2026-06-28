import { headers } from "next/headers";
import {
  CANONICAL_PUBLIC_ORIGIN,
  getCanonicalPublicOrigin,
  LEGACY_PUBLIC_HOSTS,
} from "@/lib/public-app-url";

/** Base URL for links to this app (e.g. public /register). */
export async function getPublicBaseUrl(): Promise<string> {
  const canonical = getCanonicalPublicOrigin();
  if (canonical) return canonical;

  const configured =
    process.env.NEXTAUTH_URL?.replace(/\/$/, "") ??
    process.env.AUTH_URL?.replace(/\/$/, "");
  if (configured) {
    try {
      const host = new URL(configured).hostname.toLowerCase();
      if ((LEGACY_PUBLIC_HOSTS as readonly string[]).includes(host)) {
        return CANONICAL_PUBLIC_ORIGIN;
      }
    } catch {
      /* ignore invalid URL */
    }
    return configured;
  }

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const hostname = host.split(":")[0]?.toLowerCase() ?? "";
  if ((LEGACY_PUBLIC_HOSTS as readonly string[]).includes(hostname)) {
    return CANONICAL_PUBLIC_ORIGIN;
  }
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}
