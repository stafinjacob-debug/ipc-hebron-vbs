import { promises as fs } from "fs";
import path from "path";
import { getPublicAppBaseUrl } from "@/lib/public-app-url";

/** Site-relative (/uploads/…) or absolute URL for a public asset. */
export function absolutizePublicAssetUrl(url: string): string {
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith("data:")) return trimmed;
  const base = getPublicAppBaseUrl().replace(/\/$/, "");
  return trimmed.startsWith("/") ? `${base}${trimmed}` : `${base}/${trimmed}`;
}

/** Read image bytes from a site-relative /public path or fetch a remote URL. */
export async function loadPublicImageBytes(rawUrl: string): Promise<Buffer | null> {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("/")) {
    const rel = trimmed.replace(/^\//, "");
    const filePath = path.join(process.cwd(), "public", rel);
    try {
      const bytes = await fs.readFile(filePath);
      return bytes.length ? bytes : null;
    } catch {
      return null;
    }
  }

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const res = await fetch(trimmed, { cache: "no-store" });
      if (!res.ok) return null;
      const bytes = Buffer.from(await res.arrayBuffer());
      return bytes.length ? bytes : null;
    } catch {
      return null;
    }
  }

  return null;
}
