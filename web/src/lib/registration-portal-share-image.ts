import { promises as fs } from "fs";
import path from "path";
import sharp from "sharp";
import type { PublicRegistrationSettings } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { loadPublicImageBytes } from "@/lib/public-asset-url";
import { normalizePortalSlug } from "@/lib/portal-public-path";

const SHARE_IMAGE_WIDTH = 1200;
const SHARE_IMAGE_HEIGHT = 630;

type SettingsSlice = Pick<
  PublicRegistrationSettings,
  "registrationBackgroundImageUrl" | "publicLogoUrl"
> | null;

async function loadLegacyVbsSettings(): Promise<SettingsSlice> {
  const season = await prisma.vbsSeason.findFirst({
    where: { publicRegistrationOpen: true, publicRegistrationSlug: null },
    orderBy: [{ year: "desc" }, { startDate: "desc" }],
    include: { publicRegistrationSettings: true },
  });
  return season?.publicRegistrationSettings ?? null;
}

async function resolveSettingsForShareSlug(slug: string): Promise<SettingsSlice> {
  if (slug === "legacy") return loadLegacyVbsSettings();

  const season = await prisma.vbsSeason.findFirst({
    where: { publicRegistrationSlug: slug },
    include: { publicRegistrationSettings: true },
  });
  return season?.publicRegistrationSettings ?? null;
}

function pickShareImageSource(settings: SettingsSlice): string | null {
  const background = settings?.registrationBackgroundImageUrl?.trim();
  if (background) return background;
  const logo = settings?.publicLogoUrl?.trim();
  if (logo) return logo;
  return "/vbsthemelogo.webp";
}

async function loadDefaultThemeLogoBytes(): Promise<Buffer | null> {
  const candidates = [
    path.join(process.cwd(), "public", "vbsthemelogo.webp"),
    path.join(process.cwd(), "vbsthemelogo.webp"),
    path.join(process.cwd(), "public", "vbsthemelogo.png"),
    path.join(process.cwd(), "vbsthemelogo.png"),
  ];
  for (const filePath of candidates) {
    try {
      const bytes = await fs.readFile(filePath);
      if (bytes.length) return bytes;
    } catch {
      // try next
    }
  }
  return null;
}

/** Resize a registration portal hero/background into an Open Graph thumbnail. */
export async function buildRegistrationPortalShareImage(slugRaw: string): Promise<Buffer | null> {
  const slug = slugRaw === "legacy" ? "legacy" : normalizePortalSlug(slugRaw);
  if (!slug) return null;

  const settings = await resolveSettingsForShareSlug(slug);
  const sourceUrl = pickShareImageSource(settings);
  if (!sourceUrl) return null;

  let input = await loadPublicImageBytes(sourceUrl);
  if (!input && sourceUrl !== "/vbsthemelogo.webp") {
    input = await loadDefaultThemeLogoBytes();
  }
  if (!input) return null;

  return sharp(input)
    .rotate()
    .resize(SHARE_IMAGE_WIDTH, SHARE_IMAGE_HEIGHT, {
      fit: "cover",
      position: "centre",
      withoutEnlargement: false,
    })
    .webp({ quality: 82 })
    .toBuffer();
}
