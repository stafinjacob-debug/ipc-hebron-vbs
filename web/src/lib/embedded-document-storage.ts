import { BlobServiceClient } from "@azure/storage-blob";
import { randomUUID } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_FILES = 5;
const PRIVATE_PREFIX = "embedded-documents";

function extFromMime(mime: string): string | null {
  const map: Record<string, string> = {
    "application/pdf": "pdf",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };
  return map[mime] ?? null;
}

export type StoredEmbeddedDocument = {
  objectKey: string;
  contentType: string;
  originalName: string;
  sizeBytes: number;
};

/**
 * Store academic supporting documents privately (Azure or local private/uploads).
 * Accepts up to 5 PDF/JPEG/PNG/WebP files, 5 MB each.
 */
export async function storeEmbeddedAcademicDocuments(
  files: File[],
  formId: string,
  submissionId: string,
): Promise<{ ok: true; documents: StoredEmbeddedDocument[] } | { ok: false; error: string }> {
  if (files.length === 0) {
    return { ok: false, error: "Please upload at least one academic document." };
  }
  if (files.length > MAX_FILES) {
    return { ok: false, error: `You can upload at most ${MAX_FILES} academic documents.` };
  }

  const safeForm = formId.replace(/[^a-zA-Z0-9_-]/g, "") || "form";
  const safeSub = submissionId.replace(/[^a-zA-Z0-9_-]/g, "") || randomUUID();
  const documents: StoredEmbeddedDocument[] = [];

  const conn = process.env.AZURE_STORAGE_CONNECTION_STRING?.trim();
  const containerName =
    process.env.AZURE_STORAGE_PRIVATE_CONTAINER?.trim() ||
    process.env.AZURE_STORAGE_CONTAINER?.trim() ||
    "vbs-uploads";

  for (const file of files) {
    if (!ALLOWED_TYPES.has(file.type)) {
      return {
        ok: false,
        error: `"${file.name}" must be a PDF, JPEG, PNG, or WebP file.`,
      };
    }
    if (file.size > MAX_BYTES) {
      return { ok: false, error: `"${file.name}" must be 5 MB or smaller.` };
    }
    const ext = extFromMime(file.type);
    if (!ext) return { ok: false, error: `Unsupported file type for "${file.name}".` };

    const buffer = Buffer.from(await file.arrayBuffer());
    const blobName = `${PRIVATE_PREFIX}/${safeForm}/${safeSub}/${randomUUID()}.${ext}`;
    const originalName = file.name.replace(/[^\w.\- ()]+/g, "_").slice(0, 120) || `document.${ext}`;

    if (conn) {
      try {
        const service = BlobServiceClient.fromConnectionString(conn);
        const container = service.getContainerClient(containerName);
        await container.createIfNotExists();
        const block = container.getBlockBlobClient(blobName);
        await block.uploadData(buffer, {
          blobHTTPHeaders: { blobContentType: file.type },
          metadata: {
            private: "true",
            purpose: "embedded-academic-document",
            originalName,
          },
        });
        documents.push({
          objectKey: `azure://${containerName}/${blobName}`,
          contentType: file.type,
          originalName,
          sizeBytes: file.size,
        });
      } catch (e) {
        console.error("[embedded academic doc azure]", e);
        return {
          ok: false,
          error: "Could not store academic documents. Check Azure storage configuration and try again.",
        };
      }
    } else {
      const abs = path.join(/* turbopackIgnore: true */ process.cwd(), "private", "uploads", blobName);
      await mkdir(path.dirname(abs), { recursive: true });
      await writeFile(abs, buffer);
      documents.push({
        objectKey: `local://${blobName}`,
        contentType: file.type,
        originalName,
        sizeBytes: file.size,
      });
    }
  }

  return { ok: true, documents };
}

export async function loadEmbeddedDocumentBytes(
  objectKey: string | null | undefined,
): Promise<{ bytes: Buffer; contentTypeHint?: string } | null> {
  if (!objectKey?.trim()) return null;
  const key = objectKey.trim();

  if (key.startsWith("local://")) {
    const rel = key.slice("local://".length);
    if (rel.includes("..") || !rel.startsWith(`${PRIVATE_PREFIX}/`)) return null;
    try {
      const bytes = await readFile(path.join(process.cwd(), "private", "uploads", rel));
      return { bytes };
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
      const bytes = Buffer.from(await block.downloadToBuffer());
      return { bytes };
    } catch (e) {
      console.error("[embedded academic doc load]", e);
      return null;
    }
  }

  return null;
}

export function parseAcademicDocumentKeys(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((x) => String(x)).filter(Boolean);
}
