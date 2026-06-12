/** Resolve the public signup base path for a program portal. */
export function getPortalPublicPath(season: { publicRegistrationSlug: string | null | undefined }): string {
  const slug = season.publicRegistrationSlug?.trim();
  if (slug) return `/register/${encodeURIComponent(slug)}`;
  return "/register";
}

export function getPortalLookupPath(season: { publicRegistrationSlug: string | null | undefined }): string {
  const base = getPortalPublicPath(season);
  if (base === "/register") return "/register/lookup";
  return `${base}/lookup`;
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
