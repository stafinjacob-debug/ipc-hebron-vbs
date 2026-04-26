import { BlobServiceClient } from "@azure/storage-blob";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import type { WaiverPdfMergeRow } from "@/lib/waiver-merge-fields";

function wrapText(text: string, maxLen = 92): string[] {
  const words = text.replace(/\r/g, "").split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (next.length > maxLen) {
      if (line) out.push(line);
      line = w;
    } else {
      line = next;
    }
  }
  if (line) out.push(line);
  return out;
}

export async function renderWaiverPdfBuffer(args: {
  title: string;
  /** Optional subtitle under the title (e.g. scope or summary). */
  description?: string | null;
  body: string;
  seasonName: string;
  primaryChildName: string;
  mergeRows: WaiverPdfMergeRow[];
  supplementalRows?: WaiverPdfMergeRow[];
  signerName: string;
  signedAtIso: string;
  signatureDataUrl: string;
}): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  let y = 760;
  const minY = 108;

  page.drawText(args.title, { x: 42, y, size: 20, font: bold, color: rgb(0.05, 0.11, 0.23) });
  y -= 26;
  const desc = args.description?.trim();
  if (desc) {
    for (const line of wrapText(desc, 98)) {
      if (y < minY + 100) break;
      page.drawText(line, { x: 42, y, size: 10, font: regular, color: rgb(0.25, 0.32, 0.42) });
      y -= 13;
    }
    y -= 8;
  }
  page.drawText(`Season: ${args.seasonName}`, { x: 42, y, size: 11, font: regular, color: rgb(0.2, 0.27, 0.38) });
  y -= 22;

  for (const line of wrapText(args.body, 98)) {
    if (y < minY + 80) break;
    page.drawText(line, { x: 42, y, size: 11, font: regular, color: rgb(0.1, 0.1, 0.1) });
    y -= 15;
  }

  y -= 10;
  page.drawText("Participant (this waiver)", { x: 42, y, size: 11, font: bold, color: rgb(0.05, 0.11, 0.23) });
  y -= 16;
  page.drawText(args.primaryChildName, { x: 52, y, size: 12, font: bold, color: rgb(0.1, 0.1, 0.1) });
  y -= 22;

  if (args.mergeRows.length > 0) {
    page.drawText("Information from your registration:", { x: 42, y, size: 11, font: bold, color: rgb(0.05, 0.11, 0.23) });
    y -= 16;
    let n = 0;
    for (const row of args.mergeRows) {
      if (y < minY + 60 || n >= 18) break;
      const label = `${row.label}:`;
      page.drawText(label, { x: 52, y, size: 10, font: bold, color: rgb(0.2, 0.25, 0.32) });
      y -= 13;
      for (const part of wrapText(row.value, 88)) {
        if (y < minY + 40) break;
        page.drawText(part, { x: 58, y, size: 10, font: regular, color: rgb(0.15, 0.15, 0.15) });
        y -= 12;
      }
      y -= 4;
      n++;
    }
  }

  const supp = args.supplementalRows ?? [];
  if (supp.length > 0) {
    page.drawText("Additional waiver responses:", { x: 42, y, size: 11, font: bold, color: rgb(0.05, 0.11, 0.23) });
    y -= 16;
    let n = 0;
    for (const row of supp) {
      if (y < minY + 50 || n >= 10) break;
      page.drawText(`${row.label}:`, { x: 52, y, size: 10, font: bold, color: rgb(0.2, 0.25, 0.32) });
      y -= 13;
      for (const part of wrapText(row.value, 88)) {
        if (y < minY + 30) break;
        page.drawText(part, { x: 58, y, size: 10, font: regular, color: rgb(0.15, 0.15, 0.15) });
        y -= 12;
      }
      y -= 4;
      n++;
    }
  }

  y -= 6;
  y = Math.max(y, minY + 70);
  page.drawText(`Signer: ${args.signerName}`, { x: 42, y, size: 11, font: bold, color: rgb(0.05, 0.11, 0.23) });
  y -= 16;
  page.drawText(`Signed at: ${new Date(args.signedAtIso).toLocaleString()}`, {
    x: 42,
    y,
    size: 11,
    font: regular,
    color: rgb(0.2, 0.27, 0.38),
  });
  y -= 72;

  const pngMatch = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(args.signatureDataUrl.trim());
  if (pngMatch?.[1]) {
    try {
      const sig = await pdf.embedPng(Buffer.from(pngMatch[1], "base64"));
      const dims = sig.scale(0.35);
      page.drawText("Digital signature:", { x: 42, y: y + 44, size: 10, font: regular, color: rgb(0.3, 0.3, 0.3) });
      page.drawImage(sig, { x: 42, y, width: dims.width, height: dims.height });
    } catch {
      /* leave blank if malformed */
    }
  }

  const bytes = await pdf.save();
  return Buffer.from(bytes);
}

export async function storeWaiverPdf(pdfBuffer: Buffer, seasonId: string, registrationId: string): Promise<string> {
  const conn = process.env.AZURE_STORAGE_CONNECTION_STRING?.trim();
  const containerName = process.env.AZURE_STORAGE_CONTAINER?.trim() || "vbs-uploads";
  if (conn) {
    const service = BlobServiceClient.fromConnectionString(conn);
    const container = service.getContainerClient(containerName);
    await container.createIfNotExists();
    const blobName = `waivers/${seasonId}/${registrationId}-${randomUUID()}.pdf`;
    const block = container.getBlockBlobClient(blobName);
    await block.uploadData(pdfBuffer, { blobHTTPHeaders: { blobContentType: "application/pdf" } });
    return block.url;
  }

  const safeSeason = seasonId.replace(/[^a-zA-Z0-9_-]/g, "") || "season";
  const dir = path.join(process.cwd(), "public", "uploads", "waivers", safeSeason);
  await mkdir(dir, { recursive: true });
  const fileName = `${registrationId}-${randomUUID()}.pdf`;
  const fullPath = path.join(dir, fileName);
  await writeFile(fullPath, pdfBuffer);
  return `/uploads/waivers/${safeSeason}/${fileName}`;
}
