import { headers } from "next/headers";

/** Base URL for links to this app (e.g. public /register). */
export async function getPublicBaseUrl(): Promise<string> {
  const configured = process.env.NEXTAUTH_URL?.replace(/\/$/, "");
  if (configured) return configured;

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}
