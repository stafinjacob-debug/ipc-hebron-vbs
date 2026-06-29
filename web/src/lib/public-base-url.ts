import { headers } from "next/headers";
import { getCanonicalPublicOrigin } from "@/lib/public-app-url";

/** Base URL for links to this app (e.g. public /register). */
export async function getPublicBaseUrl(): Promise<string> {
  const canonical = getCanonicalPublicOrigin();
  if (canonical) return canonical;

  const configured =
    process.env.NEXTAUTH_URL?.replace(/\/$/, "") ??
    process.env.AUTH_URL?.replace(/\/$/, "");
  if (configured) return configured;

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}
