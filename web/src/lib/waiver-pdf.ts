import { BlobServiceClient } from "@azure/storage-blob";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import type { WaiverPdfMergeRow } from "@/lib/waiver-merge-fields";
import { formatAppDateTime } from "@/lib/app-timezone";

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

/** WinAnsi-safe text for Helvetica (smart quotes / special dashes → ASCII). */
function pdfSafe(text: string): string {
  return text
    .replace(/[\u2018\u2019\u201A\u2032]/g, "'")
    .replace(/[\u201C\u201D\u201E\u2033]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u00A0/g, " ")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "?");
}

type DrawCtx = {
  pdf: PDFDocument;
  page: PDFPage;
  y: number;
  bold: PDFFont;
  regular: PDFFont;
  minY: number;
  topY: number;
};

function ensureSpace(ctx: DrawCtx, needed: number): void {
  if (ctx.y - needed >= ctx.minY) return;
  ctx.page = ctx.pdf.addPage([612, 792]);
  ctx.y = ctx.topY;
}

function drawLines(
  ctx: DrawCtx,
  lines: string[],
  opts: { size: number; font: PDFFont; color: ReturnType<typeof rgb>; lineGap: number; x?: number },
): void {
  const x = opts.x ?? 42;
  for (const line of lines) {
    ensureSpace(ctx, opts.lineGap + 2);
    ctx.page.drawText(pdfSafe(line), {
      x,
      y: ctx.y,
      size: opts.size,
      font: opts.font,
      color: opts.color,
    });
    ctx.y -= opts.lineGap;
  }
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
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const topY = 760;
  const minY = 54;
  const ctx: DrawCtx = {
    pdf,
    page: pdf.addPage([612, 792]),
    y: topY,
    bold,
    regular,
    minY,
    topY,
  };

  drawLines(ctx, wrapText(args.title, 70), {
    size: 16,
    font: bold,
    color: rgb(0.05, 0.11, 0.23),
    lineGap: 20,
  });
  ctx.y -= 4;

  const desc = args.description?.trim();
  if (desc) {
    drawLines(ctx, wrapText(desc, 98), {
      size: 10,
      font: regular,
      color: rgb(0.25, 0.32, 0.42),
      lineGap: 13,
    });
    ctx.y -= 6;
  }

  drawLines(ctx, [`Season: ${args.seasonName}`], {
    size: 11,
    font: regular,
    color: rgb(0.2, 0.27, 0.38),
    lineGap: 18,
  });

  // Preserve paragraph breaks in the waiver body.
  const bodyParagraphs = args.body.replace(/\r/g, "").split(/\n+/);
  for (const para of bodyParagraphs) {
    const trimmed = para.trim();
    if (!trimmed) {
      ctx.y -= 8;
      continue;
    }
    drawLines(ctx, wrapText(trimmed, 98), {
      size: 10,
      font: regular,
      color: rgb(0.1, 0.1, 0.1),
      lineGap: 13,
    });
    ctx.y -= 6;
  }

  ctx.y -= 8;
  drawLines(ctx, ["Participant (this waiver)"], {
    size: 11,
    font: bold,
    color: rgb(0.05, 0.11, 0.23),
    lineGap: 16,
  });
  drawLines(ctx, [args.primaryChildName], {
    size: 12,
    font: bold,
    color: rgb(0.1, 0.1, 0.1),
    lineGap: 18,
    x: 52,
  });

  if (args.mergeRows.length > 0) {
    drawLines(ctx, ["Information from your registration:"], {
      size: 11,
      font: bold,
      color: rgb(0.05, 0.11, 0.23),
      lineGap: 16,
    });
    for (const row of args.mergeRows.slice(0, 24)) {
      drawLines(ctx, [`${row.label}:`], {
        size: 10,
        font: bold,
        color: rgb(0.2, 0.25, 0.32),
        lineGap: 13,
        x: 52,
      });
      drawLines(ctx, wrapText(row.value, 88), {
        size: 10,
        font: regular,
        color: rgb(0.15, 0.15, 0.15),
        lineGap: 12,
        x: 58,
      });
      ctx.y -= 4;
    }
  }

  const supp = args.supplementalRows ?? [];
  if (supp.length > 0) {
    drawLines(ctx, ["Additional waiver responses:"], {
      size: 11,
      font: bold,
      color: rgb(0.05, 0.11, 0.23),
      lineGap: 16,
    });
    for (const row of supp.slice(0, 16)) {
      drawLines(ctx, [`${row.label}:`], {
        size: 10,
        font: bold,
        color: rgb(0.2, 0.25, 0.32),
        lineGap: 13,
        x: 52,
      });
      drawLines(ctx, wrapText(row.value, 88), {
        size: 10,
        font: regular,
        color: rgb(0.15, 0.15, 0.15),
        lineGap: 12,
        x: 58,
      });
      ctx.y -= 4;
    }
  }

  ctx.y -= 6;
  drawLines(ctx, [`Signer: ${args.signerName}`], {
    size: 11,
    font: bold,
    color: rgb(0.05, 0.11, 0.23),
    lineGap: 16,
  });
  drawLines(
    ctx,
    [
      `Signed at: ${formatAppDateTime(new Date(args.signedAtIso), {
        timeZoneName: undefined,
      })}`,
    ],
    {
      size: 11,
      font: regular,
      color: rgb(0.2, 0.27, 0.38),
      lineGap: 16,
    },
  );

  ensureSpace(ctx, 90);
  const pngMatch = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(args.signatureDataUrl.trim());
  if (pngMatch?.[1]) {
    try {
      const sig = await pdf.embedPng(Buffer.from(pngMatch[1], "base64"));
      const dims = sig.scale(0.35);
      ensureSpace(ctx, dims.height + 28);
      ctx.page.drawText("Digital signature:", {
        x: 42,
        y: ctx.y,
        size: 10,
        font: regular,
        color: rgb(0.3, 0.3, 0.3),
      });
      ctx.y -= 14;
      ctx.page.drawImage(sig, { x: 42, y: ctx.y - dims.height, width: dims.width, height: dims.height });
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
