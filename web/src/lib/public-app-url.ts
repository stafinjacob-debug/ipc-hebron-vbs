/** Public production hostname for registration links, emails, and share previews. */
export const CANONICAL_PUBLIC_ORIGIN = "https://events.ipchouston.com";

/** Hostnames that should redirect to {@link CANONICAL_PUBLIC_ORIGIN}. */
export const LEGACY_PUBLIC_HOSTS = ["vbs.ipchouston.com"] as const;

function trimTrailingSlash(value: string | undefined): string | undefined {
  return value?.replace(/\/$/, "");
}

/** Production origin for public links; empty in local dev unless overridden. */
export function getCanonicalPublicOrigin(): string {
  const override = trimTrailingSlash(process.env.CANONICAL_PUBLIC_URL);
  if (override) return override;
  if (process.env.NODE_ENV === "production") return CANONICAL_PUBLIC_ORIGIN;
  return "";
}

/** Sync base URL for server actions (no `headers()`). Prefer canonical origin in production. */
export function getPublicAppBaseUrl(): string {
  const canonical = getCanonicalPublicOrigin();
  if (canonical) return canonical;

  const configured =
    trimTrailingSlash(process.env.NEXTAUTH_URL) ??
    trimTrailingSlash(process.env.AUTH_URL) ??
    trimTrailingSlash(process.env.NEXT_PUBLIC_SITE_URL);

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

  const azureHost = process.env.WEBSITE_HOSTNAME?.trim();
  if (azureHost) return `https://${azureHost.replace(/\/$/, "")}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}
