import type { BadgePrintPayload } from "@/lib/badge-print";
import { badgeLabelPageCss } from "@/lib/badge-print";
import {
  BADGE_PRINT_FONT_FAMILY,
  badgePrintFontDir,
  badgePrintFontFiles,
  badgePrintFontStatus,
} from "@/lib/badge-print-fonts";

/** Match thermal printer resolution (Brother QL series). */
const BADGE_RENDER_DPI = 300;

/** Printable width for 62 mm continuous roll (DK-2205) at 300 DPI — Brother QL raster width. */
const BROTHER_QL_62MM_PRINTABLE_WIDTH = 696;

type LabelCanvas = {
  w: number;
  h: number;
  widthIn: number;
  heightIn: number;
  horizontal: boolean;
};

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function labelBaseInches(
  labelSize: BadgePrintPayload["settings"]["labelSize"],
): { widthIn: number; heightIn: number } {
  switch (labelSize) {
    case "LABEL_4X6":
      return { widthIn: 4, heightIn: 6 };
    case "LABEL_62MM":
      return { widthIn: 62 / 25.4, heightIn: 100 / 25.4 };
    default:
      return { widthIn: 2, heightIn: 3 };
  }
}

function labelCanvas(
  labelSize: BadgePrintPayload["settings"]["labelSize"],
  orientation: BadgePrintPayload["settings"]["orientation"],
): LabelCanvas {
  const base = labelBaseInches(labelSize);
  const horizontal = orientation === "HORIZONTAL";
  const widthIn = horizontal ? base.heightIn : base.widthIn;
  const heightIn = horizontal ? base.widthIn : base.heightIn;
  return {
    w: Math.round(widthIn * BADGE_RENDER_DPI),
    h: Math.round(heightIn * BADGE_RENDER_DPI),
    widthIn,
    heightIn,
    horizontal,
  };
}

/**
 * Brother QL maps PNG width → tape width and PNG height → feed/cut length.
 * Mobile check-in uses 62 mm roll; render at printable dot width (696), not landscape pixels.
 */
function brotherQlCanvas(
  labelSize: BadgePrintPayload["settings"]["labelSize"],
  orientation: BadgePrintPayload["settings"]["orientation"],
): LabelCanvas {
  const base = labelBaseInches(labelSize);
  const horizontal = orientation === "HORIZONTAL";
  const tapeWidthIn = base.widthIn;
  const feedLengthIn = base.heightIn;

  const w =
    labelSize === "LABEL_4X6"
      ? Math.round(tapeWidthIn * BADGE_RENDER_DPI)
      : BROTHER_QL_62MM_PRINTABLE_WIDTH;
  const h = Math.round(feedLengthIn * BADGE_RENDER_DPI);

  return {
    w,
    h,
    widthIn: tapeWidthIn,
    heightIn: feedLengthIn,
    horizontal,
  };
}

/** Convert CSS pt sizes used in badge-print-document.ts to PNG pixels. */
function ptToPx(pt: number, canvas: LabelCanvas): number {
  return Math.round((pt * canvas.h) / (72 * canvas.heightIn));
}

/** Convert CSS inch sizes used in badge-print-document.ts to PNG pixels. */
function inchToPx(inches: number, canvas: LabelCanvas): number {
  return Math.round((inches * canvas.h) / canvas.heightIn);
}

function wrapLines(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars) {
      current = next;
    } else {
      if (current) lines.push(current);
      current = word;
      if (lines.length >= maxLines) break;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  return lines.slice(0, maxLines);
}

function renderStandardVertical(payload: BadgePrintPayload, canvas: LabelCanvas): string {
  const { w, h, horizontal } = canvas;
  const pad = inchToPx(0.1, canvas);
  const qrSize = inchToPx(horizontal ? 0.78 : 0.95, canvas);
  let y = pad + ptToPx(horizontal ? 13 : 18, canvas);

  const lines = payload.lines
    .map((line) => {
      const size =
        line.kind === "name"
          ? ptToPx(horizontal ? 13 : 18, canvas)
          : line.kind === "season"
            ? ptToPx(horizontal ? 7 : 9, canvas)
            : line.kind === "number"
              ? ptToPx(horizontal ? 9 : 11, canvas)
              : line.kind === "allergy"
                ? ptToPx(horizontal ? 7 : 9, canvas)
                : ptToPx(horizontal ? 8.5 : 10, canvas);
      const weight = line.kind === "name" || line.kind === "number" ? 700 : 600;
      const fill = line.kind === "allergy" ? "#b45309" : "#0f172a";
      const lineY = y + size;
      y += size + inchToPx(0.03, canvas);
      return `<text x="${w / 2}" y="${lineY}" text-anchor="middle" font-family="${BADGE_PRINT_FONT_FAMILY}" font-size="${size}" font-weight="${weight}" fill="${fill}">${escapeXml(line.text)}</text>`;
    })
    .join("\n");

  const qr =
    payload.qrDataUrl && payload.settings.showQrCode
      ? `<image href="${payload.qrDataUrl}" x="${w / 2 - qrSize / 2}" y="${h - pad - qrSize}" width="${qrSize}" height="${qrSize}" />`
      : "";

  return `${lines}${qr}`;
}

function renderKidCheck(payload: BadgePrintPayload, canvas: LabelCanvas): string {
  const { w, h } = canvas;
  const s = payload.structured;
  const name = escapeXml(`${s.firstName} ${s.lastName}`.trim() || payload.childName);

  const pad = inchToPx(0.1, canvas);
  const nameSize = ptToPx(13, canvas);
  const codeSize = ptToPx(8, canvas);
  const classSize = ptToPx(11, canvas);
  const lineSize = ptToPx(7.5, canvas);
  const seasonSize = ptToPx(7, canvas);
  const timestampSize = ptToPx(6, canvas);
  const lineGap = inchToPx(0.025, canvas);
  const wrapGap = inchToPx(0.016, canvas);
  const stroke = Math.max(2, Math.round(inchToPx(0.015, canvas)));

  const nameY = pad + nameSize;
  const dividerY = nameY + inchToPx(0.05, canvas);

  const codePadX = inchToPx(0.05, canvas);
  const codePadY = inchToPx(0.02, canvas);
  const codeText = s.securityCode ? escapeXml(s.securityCode) : "";
  const codeBoxW = Math.max(inchToPx(0.75, canvas), codeText.length * codeSize * 0.62 + codePadX * 2);
  const codeBoxH = codeSize + codePadY * 2;
  const codeBoxX = w - pad - codeBoxW;
  const code = codeText
    ? `<rect x="${codeBoxX}" y="${pad}" width="${codeBoxW}" height="${codeBoxH}" fill="#0f172a" rx="2"/>
       <text x="${codeBoxX + codeBoxW / 2}" y="${pad + codePadY + codeSize * 0.82}" text-anchor="middle" font-family="${BADGE_PRINT_FONT_FAMILY}" font-size="${codeSize}" font-weight="800" fill="#ffffff">${codeText}</text>`
    : "";

  type BodyLine = { text: string; kind: "season" | "class" | "detail" };
  const bodyLines: BodyLine[] = [];
  if (s.seasonLine) bodyLines.push({ text: escapeXml(s.seasonLine), kind: "season" });
  if (s.classLine) bodyLines.push({ text: escapeXml(s.classLine), kind: "class" });
  else if (s.serviceLine) bodyLines.push({ text: escapeXml(s.serviceLine), kind: "class" });
  if (s.guardianLine) {
    bodyLines.push({ text: `Guardian: ${escapeXml(s.guardianLine)}`, kind: "detail" });
  }
  if (s.guardianPhone) {
    bodyLines.push({ text: `Emergency contact: ${escapeXml(s.guardianPhone)}`, kind: "detail" });
  }
  if (s.birthdate) bodyLines.push({ text: `Birthdate: ${escapeXml(s.birthdate)}`, kind: "detail" });
  if (s.medicalLine) {
    bodyLines.push({ text: `Medical / allergy info: ${escapeXml(s.medicalLine)}`, kind: "detail" });
  }
  if (s.notesLine) bodyLines.push({ text: `Note: ${escapeXml(s.notesLine)}`, kind: "detail" });

  let bodyY = dividerY + inchToPx(0.06, canvas);
  const bodyParts: string[] = [];
  for (const line of bodyLines) {
    const size =
      line.kind === "season" ? seasonSize : line.kind === "class" ? classSize : lineSize;
    const weight = line.kind === "class" ? 800 : 600;
    const fill = line.kind === "season" ? "#64748b" : "#1e293b";
    const wrapped = wrapLines(line.text, Math.max(24, Math.floor((w - pad * 2) / (size * 0.55))), 2);
    for (let j = 0; j < wrapped.length; j++) {
      bodyY += size + (j === 0 ? 0 : wrapGap);
      bodyParts.push(
        `<text x="${pad}" y="${bodyY}" font-family="${BADGE_PRINT_FONT_FAMILY}" font-size="${size}" font-weight="${weight}" fill="${fill}">${wrapped[j]}</text>`,
      );
    }
    bodyY += lineGap;
  }

  const qrSize = inchToPx(0.55, canvas);
  const footerBlock = qrSize + (s.printedAt ? timestampSize + inchToPx(0.02, canvas) : 0);
  const footerTop = h - pad - footerBlock;

  const timestamp = s.printedAt
    ? `<text x="${w / 2}" y="${footerTop + timestampSize * 0.85}" text-anchor="middle" font-family="${BADGE_PRINT_FONT_FAMILY}" font-size="${timestampSize}" fill="#64748b">${escapeXml(s.printedAt)}</text>`
    : "";

  const footerQr =
    payload.qrDataUrl && payload.settings.showQrCode
      ? `<image href="${payload.qrDataUrl}" x="${w / 2 - qrSize / 2}" y="${footerTop + (s.printedAt ? timestampSize + inchToPx(0.02, canvas) : 0)}" width="${qrSize}" height="${qrSize}" />`
      : payload.barcodeDataUrl
        ? `<image href="${payload.barcodeDataUrl}" x="${pad}" y="${footerTop}" width="${w - pad * 2}" height="${inchToPx(0.22, canvas)}" preserveAspectRatio="xMidYMid meet" />`
        : "";

  return `
    <text x="${pad}" y="${nameY}" font-family="${BADGE_PRINT_FONT_FAMILY}" font-size="${nameSize}" font-weight="800" fill="#0f172a">${name}</text>
    ${code}
    <line x1="${pad}" y1="${dividerY}" x2="${w - pad}" y2="${dividerY}" stroke="#0f172a" stroke-width="${stroke}" />
    ${bodyParts.join("\n")}
    ${timestamp}
    ${footerQr}
  `;
}

export function buildBadgePrintSvg(
  payload: BadgePrintPayload,
  options: BadgePngRenderOptions = {},
): string {
  const dims = badgeLabelPageCss(payload.settings.labelSize, payload.settings.orientation);
  const canvas = options.brotherQl
    ? brotherQlCanvas(payload.settings.labelSize, payload.settings.orientation)
    : labelCanvas(payload.settings.labelSize, payload.settings.orientation);
  const { w, h } = canvas;

  const layout = payload.settings.horizontalLayout;
  const inner =
    dims.isHorizontal && layout === "KIDCHECK"
      ? renderKidCheck(payload, canvas)
      : dims.isHorizontal && layout === "NAME_CODE_HEADER"
        ? renderKidCheck(payload, canvas)
        : renderStandardVertical(payload, canvas);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="100%" height="100%" fill="#ffffff"/>
  ${inner}
</svg>`;
}

export type BadgePngRenderOptions = {
  /** Render at Brother QL tape width × feed length (mobile Bluetooth/Wi‑Fi printing). */
  brotherQl?: boolean;
};

export type BadgePngRenderResult = {
  png: Buffer;
  width: number;
  height: number;
};

export async function renderBadgePngBuffer(
  payload: BadgePrintPayload,
  options: BadgePngRenderOptions = {},
): Promise<Buffer> {
  const result = await renderBadgePngWithMeta(payload, options);
  return result.png;
}

export async function renderBadgePngWithMeta(
  payload: BadgePrintPayload,
  options: BadgePngRenderOptions = {},
): Promise<BadgePngRenderResult> {
  const fontStatus = badgePrintFontStatus();
  if (!fontStatus.ok) {
    console.error("[badge-print] DejaVu fonts unavailable", fontStatus);
    throw new Error("Badge fonts are not available on the server.");
  }

  const canvas = options.brotherQl
    ? brotherQlCanvas(payload.settings.labelSize, payload.settings.orientation)
    : labelCanvas(payload.settings.labelSize, payload.settings.orientation);

  const { Resvg } = await import("@resvg/resvg-js");
  const svg = buildBadgePrintSvg(payload, options);
  const resvg = new Resvg(svg, {
    dpi: BADGE_RENDER_DPI,
    font: {
      fontDirs: [badgePrintFontDir()],
      fontFiles: badgePrintFontFiles(),
      loadSystemFonts: false,
      defaultFontFamily: BADGE_PRINT_FONT_FAMILY,
      sansSerifFamily: BADGE_PRINT_FONT_FAMILY,
    },
  });
  const png = Buffer.from(resvg.render().asPng());

  return { png, width: canvas.w, height: canvas.h };
}
