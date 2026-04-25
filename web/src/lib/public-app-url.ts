/** Sync base URL for server actions (no `headers()`). Prefer `NEXTAUTH_URL` / `AUTH_URL` in production. */
export function getPublicAppBaseUrl(): string {
  const a =
    process.env.NEXTAUTH_URL?.replace(/\/$/, "") ??
    process.env.AUTH_URL?.replace(/\/$/, "") ??
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (a) return a;
  const azureHost = process.env.WEBSITE_HOSTNAME?.trim();
  if (azureHost) return `https://${azureHost.replace(/\/$/, "")}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}
