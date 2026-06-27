/** Optional short public paths for share links (slug → path without /register). */
const PORTAL_SHORT_PATHS: Record<string, string> = {
  basketball: "/basketball",
};

/** Resolve the public signup base path for a program portal. */
export function getPortalPublicPath(season: { publicRegistrationSlug: string | null | undefined }): string {
  const slug = season.publicRegistrationSlug?.trim();
  if (slug) {
    const short = PORTAL_SHORT_PATHS[slug];
    if (short) return short;
    return `/register/${encodeURIComponent(slug)}`;
  }
  return "/register";
}

/** True only for programs on the shared legacy `/register` portal (no slug). */
export function isLegacyVbsPortal(season: { publicRegistrationSlug: string | null | undefined }): boolean {
  return !season.publicRegistrationSlug?.trim();
}

export function getPortalLookupPath(season: { publicRegistrationSlug: string | null | undefined }): string {
  const base = getPortalPublicPath(season);
  if (base === "/register") return "/register/lookup";
  return `${base}/lookup`;
}

export function getPortalTicketPath(season: { publicRegistrationSlug: string | null | undefined }): string {
  const base = getPortalPublicPath(season);
  if (base === "/register") return "/register/ticket";
  return `${base}/ticket`;
}

/** Absolute public signup URL for QR codes and share links. */
export function buildPublicSignupUrl(
  publicBase: string,
  season: { publicRegistrationSlug: string | null | undefined },
): string {
  const base = publicBase.replace(/\/$/, "");
  return `${base}${getPortalPublicPath(season)}`;
}

export function buildPublicLookupUrl(
  publicBase: string,
  season: { publicRegistrationSlug: string | null | undefined },
): string {
  const base = publicBase.replace(/\/$/, "");
  return `${base}${getPortalLookupPath(season)}`;
}

export function buildPublicTicketUrl(
  publicBase: string,
  season: { publicRegistrationSlug: string | null | undefined },
  checkInToken: string,
): string {
  const base = publicBase.replace(/\/$/, "");
  const token = checkInToken.trim();
  return `${base}${getPortalTicketPath(season)}?t=${encodeURIComponent(token)}`;
}

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function normalizePortalSlug(raw: string): string | null {
  const v = raw.trim().toLowerCase();
  if (!v) return null;
  if (!SLUG_RE.test(v)) return null;
  if (v.length > 64) return null;
  return v;
}

export function validatePortalSlug(raw: string): { ok: true; slug: string } | { ok: false; message: string } {
  const v = raw.trim().toLowerCase();
  if (!v) return { ok: false, message: "Slug is required for new programs." };
  if (v.length > 64) return { ok: false, message: "Slug must be 64 characters or fewer." };
  if (!SLUG_RE.test(v)) {
    return {
      ok: false,
      message: "Slug must use lowercase letters, numbers, and hyphens only (e.g. soccer-2026).",
    };
  }
  return { ok: true, slug: v };
}
