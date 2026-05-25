import { BlobServiceClient } from "@azure/storage-blob";
import { randomUUID } from "crypto";
import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_BYTES = 1.5 * 1024 * 1024;

function extFromMime(mime: string): string | null {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
  };
  return map[mime] ?? null;
}

export async function uploadBadgeLogoImage(
  file: File,
  seasonId: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  if (!ALLOWED_TYPES.has(file.type)) {
    return { ok: false, error: "Use a JPEG, PNG, WebP, or GIF image." };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, error: "Logo must be 1.5 MB or smaller." };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = extFromMime(file.type);
  if (!ext) {
    return { ok: false, error: "Unsupported image type." };
  }

  const conn = process.env.AZURE_STORAGE_CONNECTION_STRING?.trim();
  const containerName = process.env.AZURE_STORAGE_CONTAINER?.trim() || "vbs-uploads";

  if (conn) {
    try {
      const service = BlobServiceClient.fromConnectionString(conn);
      const container = service.getContainerClient(containerName);
      await container.createIfNotExists();
      const blobName = `badge-logo/${seasonId}/${randomUUID()}.${ext}`;
      const block = container.getBlockBlobClient(blobName);
      await block.uploadData(buffer, {
        blobHTTPHeaders: { blobContentType: file.type },
      });
      return { ok: true, url: block.url };
    } catch (e) {
      console.error(e);
      return {
        ok: false,
        error:
          "Could not upload to Azure Blob Storage. Check AZURE_STORAGE_CONNECTION_STRING and container access.",
      };
    }
  }

  const safeSeason = seasonId.replace(/[^a-zA-Z0-9_-]/g, "");
  if (!safeSeason) {
    return { ok: false, error: "Invalid season id." };
  }

  const dir = path.join(process.cwd(), "public", "uploads", "badge-logo", safeSeason);
  await mkdir(dir, { recursive: true });
  const filename = `${randomUUID()}.${ext}`;
  await writeFile(path.join(dir, filename), buffer);
  return { ok: true, url: `/uploads/badge-logo/${safeSeason}/${filename}` };
}

/** Removes a previously stored local badge logo (/uploads/badge-logo/…). Skips Azure URLs. */
export async function deleteLocalBadgeLogo(url: string | null | undefined): Promise<void> {
  if (!url || url.startsWith("http")) return;
  if (!url.startsWith("/uploads/badge-logo/")) return;
  const rel = url.replace(/^\//, "");
  try {
    await unlink(path.join(process.cwd(), "public", rel));
  } catch {
    // already deleted or missing
  }
}
