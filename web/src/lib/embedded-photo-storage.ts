import { BlobServiceClient } from "@azure/storage-blob";
import { randomUUID } from "crypto";
import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import path from "path";
import sharp from "sharp";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 2.5 * 1024 * 1024;
const PRIVATE_PREFIX = "embedded-photos";

export type StoredEmbeddedPhoto = {
  objectKey: string;
  contentType: "image/jpeg";
};

/**
 * Normalize passport photos: strip metadata, fix orientation, bound size, store privately.
 * Returns an opaque object key — never a public URL.
 */
export async function storeEmbeddedCandidatePhoto(
  file: File,
  formId: string,
  submissionId: string,
): Promise<{ ok: true; photo: StoredEmbeddedPhoto } | { ok: false; error: string }> {
  if (!ALLOWED_TYPES.has(file.type)) {
    return { ok: false, error: "Use a JPEG, PNG, or WebP image for the passport photo." };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, error: "Passport photo must be 2.5 MB or smaller." };
  }

  let jpegBuffer: Buffer;
  try {
    const input = Buffer.from(await file.arrayBuffer());
    jpegBuffer = await sharp(input)
      .rotate()
      .resize({
        width: 900,
        height: 1200,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer();
  } catch {
    return { ok: false, error: "Could not process the uploaded photo. Try another image." };
  }

  const safeForm = formId.replace(/[^a-zA-Z0-9_-]/g, "") || "form";
  const safeSub = submissionId.replace(/[^a-zA-Z0-9_-]/g, "") || randomUUID();
  const blobName = `${PRIVATE_PREFIX}/${safeForm}/${safeSub}/${randomUUID()}.jpg`;

  const conn = process.env.AZURE_STORAGE_CONNECTION_STRING?.trim();
  const containerName =
    process.env.AZURE_STORAGE_PRIVATE_CONTAINER?.trim() ||
    process.env.AZURE_STORAGE_CONTAINER?.trim() ||
    "vbs-uploads";

  if (conn) {
    try {
      const service = BlobServiceClient.fromConnectionString(conn);
      const container = service.getContainerClient(containerName);
      await container.createIfNotExists();
      const block = container.getBlockBlobClient(blobName);
      await block.uploadData(jpegBuffer, {
        blobHTTPHeaders: { blobContentType: "image/jpeg" },
        metadata: { private: "true", purpose: "embedded-passport-photo" },
      });
      return { ok: true, photo: { objectKey: `azure://${containerName}/${blobName}`, contentType: "image/jpeg" } };
    } catch (e) {
      console.error("[embedded photo azure]", e);
      return {
        ok: false,
        error:
          "Could not store the passport photo. Check Azure storage configuration and try again.",
      };
    }
  }

  // Local private fallback (outside public/)
  const rel = blobName;
  const abs = path.join(/* turbopackIgnore: true */ process.cwd(), "private", "uploads", rel);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, jpegBuffer);
  return { ok: true, photo: { objectKey: `local://${rel}`, contentType: "image/jpeg" } };
}

export async function loadEmbeddedPhotoBytes(
  objectKey: string | null | undefined,
): Promise<Buffer | null> {
  if (!objectKey?.trim()) return null;
  const key = objectKey.trim();

  if (key.startsWith("local://")) {
    const rel = key.slice("local://".length);
    if (rel.includes("..") || !rel.startsWith(`${PRIVATE_PREFIX}/`)) return null;
    try {
      return await readFile(path.join(process.cwd(), "private", "uploads", rel));
    } catch {
      return null;
    }
  }

  if (key.startsWith("azure://")) {
    const rest = key.slice("azure://".length);
    const slash = rest.indexOf("/");
    if (slash < 1) return null;
    const containerName = rest.slice(0, slash);
    const blobName = rest.slice(slash + 1);
    const conn = process.env.AZURE_STORAGE_CONNECTION_STRING?.trim();
    if (!conn) return null;
    try {
      const service = BlobServiceClient.fromConnectionString(conn);
      const block = service.getContainerClient(containerName).getBlockBlobClient(blobName);
      return Buffer.from(await block.downloadToBuffer());
    } catch (e) {
      console.error("[embedded photo load]", e);
      return null;
    }
  }

  return null;
}

export async function deleteEmbeddedPhoto(objectKey: string | null | undefined): Promise<void> {
  if (!objectKey?.trim()) return;
  const key = objectKey.trim();
  if (key.startsWith("local://")) {
    const rel = key.slice("local://".length);
    if (rel.includes("..") || !rel.startsWith(`${PRIVATE_PREFIX}/`)) return;
    try {
      await unlink(path.join(process.cwd(), "private", "uploads", rel));
    } catch {
      /* missing */
    }
    return;
  }
  if (key.startsWith("azure://")) {
    const rest = key.slice("azure://".length);
    const slash = rest.indexOf("/");
    if (slash < 1) return;
    const containerName = rest.slice(0, slash);
    const blobName = rest.slice(slash + 1);
    const conn = process.env.AZURE_STORAGE_CONNECTION_STRING?.trim();
    if (!conn) return;
    try {
      const service = BlobServiceClient.fromConnectionString(conn);
      await service.getContainerClient(containerName).getBlockBlobClient(blobName).deleteIfExists();
    } catch {
      /* ignore */
    }
  }
}
