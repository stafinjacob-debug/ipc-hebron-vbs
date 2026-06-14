import type { PublicRegistrationSettings, VbsSeason } from "@/generated/prisma";
import { resolvePortalBranding } from "@/lib/portal-branding";
import { getPublicAppBaseUrl } from "@/lib/public-app-url";
import { promises as fs } from "fs";
import path from "path";

export type RegistrationTicketDisplay = {
  eventName: string;
  brandName: string;
  ticketLabel: string;
  footerText: string;
  logoSrc: string | null;
  logoAlt: string;
  isLegacyVbs: boolean;
};

function isLegacyVbsSeason(season: Pick<VbsSeason, "publicRegistrationSlug" | "programKind">): boolean {
  return !season.publicRegistrationSlug?.trim() && season.programKind === "VBS";
}

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

export async function resolveRegistrationTicketDisplay(
  season: Pick<VbsSeason, "name" | "publicRegistrationSlug" | "programKind">,
  settings: PublicRegistrationSettings | null,
): Promise<RegistrationTicketDisplay> {
  const isLegacyVbs = isLegacyVbsSeason(season);
  const branding = resolvePortalBranding(season, settings, { legacyVbsDefaults: isLegacyVbs });
  const eventName = season.name.trim() || "Registration";

  let logoSrc: string | null = null;
  if (isLegacyVbs) {
    logoSrc = await loadLegacyVbsThemeLogoDataUrl();
  } else if (branding.logoUrl?.trim()) {
    logoSrc = absolutizePublicAssetUrl(branding.logoUrl);
  } else if (settings?.registrationBackgroundImageUrl?.trim()) {
    logoSrc = absolutizePublicAssetUrl(settings.registrationBackgroundImageUrl);
  }

  const brandName = branding.headerLabel.trim() || eventName;
  const ticketLabel = isLegacyVbs ? "VBS ticket" : "Registration ticket";
  const footerText = isLegacyVbs
    ? `${brandName} · Digital ticket only — not a payment receipt.`
    : `${branding.churchDisplayName} · ${eventName} · Digital ticket only — not a payment receipt.`;

  return {
    eventName,
    brandName,
    ticketLabel,
    footerText,
    logoSrc,
    logoAlt: isLegacyVbs ? "VBS theme" : `${eventName} logo`,
    isLegacyVbs,
  };
}
