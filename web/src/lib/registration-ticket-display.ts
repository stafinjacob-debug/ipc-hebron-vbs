import type { PublicRegistrationSettings, VbsSeason } from "@/generated/prisma";
import { resolvePortalBranding } from "@/lib/portal-branding";
import { clampRegistrationBackgroundDimmingPercent } from "@/lib/registration-background-scrim";
import { getPublicAppBaseUrl } from "@/lib/public-app-url";
import { isLegacyVbsPortal } from "@/lib/portal-public-path";
import { promises as fs } from "fs";
import path from "path";

export type RegistrationTicketDisplay = {
  eventName: string;
  brandName: string;
  ticketLabel: string;
  footerText: string;
  /** Resolved image URL or data URL for the ticket header. */
  heroSrc: string | null;
  heroAlt: string;
  /** How the header should render the hero asset. */
  heroStyle: "legacy-logo" | "background-cover" | "logo-contain" | "none";
  heroScrimOpacity: number;
  isLegacyVbs: boolean;
};

function absolutizePublicAssetUrl(url: string): string {
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith("data:")) return trimmed;
  const base = getPublicAppBaseUrl().replace(/\/$/, "");
  return trimmed.startsWith("/") ? `${base}${trimmed}` : `${base}/${trimmed}`;
}

async function loadLegacyVbsThemeLogoDataUrl(): Promise<string | null> {
  const candidates = [
    { filePath: path.join(process.cwd(), "vbsthemelogo.png"), mime: "image/png" },
    { filePath: path.join(process.cwd(), "vbsthemelogo.webp"), mime: "image/webp" },
    { filePath: path.join(process.cwd(), "public", "vbsthemelogo.webp"), mime: "image/webp" },
    { filePath: path.join(process.cwd(), "public", "vbsthemelogo.png"), mime: "image/png" },
  ] as const;
  for (const c of candidates) {
    try {
      const bytes = await fs.readFile(c.filePath);
      if (!bytes.length) continue;
      return `data:${c.mime};base64,${bytes.toString("base64")}`;
    } catch {
      // try next format
    }
  }
  return null;
}

async function readLocalPublicImageAsDataUrl(urlPath: string): Promise<string | null> {
  const rel = urlPath.replace(/^\//, "");
  const filePath = path.join(process.cwd(), "public", rel);
  try {
    const bytes = await fs.readFile(filePath);
    if (!bytes.length) return null;
    const ext = path.extname(filePath).toLowerCase();
    const mime =
      ext === ".webp"
        ? "image/webp"
        : ext === ".png"
          ? "image/png"
          : ext === ".gif"
            ? "image/gif"
            : "image/jpeg";
    return `data:${mime};base64,${bytes.toString("base64")}`;
  } catch {
    return null;
  }
}

/** Fetch remote or local image bytes for reliable ticket rendering. */
async function resolveHeroImageSrc(rawUrl: string): Promise<string> {
  const url = absolutizePublicAssetUrl(rawUrl);
  if (url.startsWith("data:")) return url;

  if (url.startsWith("/")) {
    const dataUrl = await readLocalPublicImageAsDataUrl(url);
    if (dataUrl) return dataUrl;
    return absolutizePublicAssetUrl(url);
  }

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return url;
    const bytes = Buffer.from(await res.arrayBuffer());
    if (!bytes.length) return url;
    const mime = res.headers.get("content-type")?.split(";")[0]?.trim() || "image/jpeg";
    return `data:${mime};base64,${bytes.toString("base64")}`;
  } catch {
    return url;
  }
}

function isVbsDefaultLogoUrl(url: string | null | undefined): boolean {
  const v = url?.trim().toLowerCase() ?? "";
  return v === "/vbsthemelogo.webp" || v.endsWith("/vbsthemelogo.webp");
}

export async function resolveRegistrationTicketDisplay(
  season: Pick<VbsSeason, "name" | "publicRegistrationSlug" | "programKind">,
  settings: PublicRegistrationSettings | null,
): Promise<RegistrationTicketDisplay> {
  const isLegacyVbs = isLegacyVbsPortal(season);
  const branding = resolvePortalBranding(season, settings, { legacyVbsDefaults: isLegacyVbs });
  const eventName = season.name.trim() || "Registration";
  const brandName = branding.headerLabel.trim() || eventName;
  const ticketLabel = isLegacyVbs ? "VBS ticket" : "Registration ticket";
  const footerText = isLegacyVbs
    ? `${brandName} · Digital ticket only — not a payment receipt.`
    : `${branding.churchDisplayName} · ${eventName} · Digital ticket only — not a payment receipt.`;

  const scrimPercent = clampRegistrationBackgroundDimmingPercent(
    settings?.registrationBackgroundDimmingPercent,
  );
  const heroScrimOpacity = Math.min(0.85, Math.max(0, scrimPercent / 100));

  if (isLegacyVbs) {
    return {
      eventName,
      brandName,
      ticketLabel,
      footerText,
      heroSrc: await loadLegacyVbsThemeLogoDataUrl(),
      heroAlt: "VBS theme",
      heroStyle: "legacy-logo",
      heroScrimOpacity: 0,
      isLegacyVbs,
    };
  }

  const backgroundUrl = settings?.registrationBackgroundImageUrl?.trim() || null;
  const logoUrl =
    branding.logoUrl?.trim() && !isVbsDefaultLogoUrl(branding.logoUrl)
      ? branding.logoUrl.trim()
      : null;

  if (backgroundUrl) {
    return {
      eventName,
      brandName,
      ticketLabel,
      footerText,
      heroSrc: await resolveHeroImageSrc(backgroundUrl),
      heroAlt: `${eventName} background`,
      heroStyle: "background-cover",
      heroScrimOpacity,
      isLegacyVbs,
    };
  }

  if (logoUrl) {
    return {
      eventName,
      brandName,
      ticketLabel,
      footerText,
      heroSrc: await resolveHeroImageSrc(logoUrl),
      heroAlt: `${eventName} logo`,
      heroStyle: "logo-contain",
      heroScrimOpacity: 0,
      isLegacyVbs,
    };
  }

  return {
    eventName,
    brandName,
    ticketLabel,
    footerText,
    heroSrc: null,
    heroAlt: eventName,
    heroStyle: "none",
    heroScrimOpacity: 0,
    isLegacyVbs,
  };
}

/** Hero image for ticket emails — background first, then custom logo. */
export function resolveTicketEmailHeroUrl(
  season: Pick<VbsSeason, "publicRegistrationSlug">,
  settings: PublicRegistrationSettings | null,
  branding: { logoUrl: string | null },
): string | null {
  if (isLegacyVbsPortal(season)) return null;
  const backgroundUrl = settings?.registrationBackgroundImageUrl?.trim();
  if (backgroundUrl) return backgroundUrl;
  const logoUrl = branding.logoUrl?.trim();
  if (logoUrl && !isVbsDefaultLogoUrl(logoUrl)) return logoUrl;
  return null;
}
