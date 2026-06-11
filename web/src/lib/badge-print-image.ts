import type { BadgePrintPayload } from "@/lib/badge-print";
import { badgeLabelPageCss } from "@/lib/badge-print";
import {
  BADGE_PRINT_FONT_FAMILY,
  badgePrintFontFiles,
} from "@/lib/badge-print-fonts";

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function labelPixels(labelSize: BadgePrintPayload["settings"]["labelSize"]): {
  width: number;
  height: number;
} {
  switch (labelSize) {
    case "LABEL_4X6":
      return { width: 812, height: 1218 };
    case "LABEL_62MM":
      return { width: 496, height: 799 };
    default:
      return { width: 406, height: 609 };
  }
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

function renderStandardVertical(payload: BadgePrintPayload, w: number, h: number): string {
  const lines = payload.lines
    .map((line, i) => {
      const y = 48 + i * 28;
      const size =
        line.kind === "name" ? 28 : line.kind === "season" ? 11 : line.kind === "number" ? 14 : 12;
      const weight = line.kind === "name" || line.kind === "number" ? 700 : 600;
      const fill = line.kind === "allergy" ? "#b45309" : "#0f172a";
      return `<text x="${w / 2}" y="${y}" text-anchor="middle" font-family="${BADGE_PRINT_FONT_FAMILY}" font-size="${size}" font-weight="${weight}" fill="${fill}">${escapeXml(line.text)}</text>`;
    })
    .join("\n");

  const qr =
    payload.qrDataUrl && payload.settings.showQrCode
      ? `<image href="${payload.qrDataUrl}" x="${w / 2 - 48}" y="${h - 120}" width="96" height="96" />`
      : "";

  return `${lines}${qr}`;
}

function renderKidCheck(payload: BadgePrintPayload, w: number, h: number): string {
  const s = payload.structured;
  const name = escapeXml(`${s.firstName} ${s.lastName}`.trim() || payload.childName);
  const code = s.securityCode
    ? `<rect x="${w - 110}" y="16" width="94" height="34" fill="#0f172a" rx="2"/>
       <text x="${w - 63}" y="38" text-anchor="middle" font-family="${BADGE_PRINT_FONT_FAMILY}" font-size="11" font-weight="800" fill="#ffffff">${escapeXml(s.securityCode)}</text>`
    : "";

  const bodyLines: string[] = [];
  if (s.seasonLine) bodyLines.push(escapeXml(s.seasonLine));
  if (s.classLine) bodyLines.push(escapeXml(s.classLine));
  else if (s.serviceLine) bodyLines.push(escapeXml(s.serviceLine));
  if (s.guardianLine) bodyLines.push(`Guardian: ${escapeXml(s.guardianLine)}`);
  if (s.guardianPhone) bodyLines.push(`Emergency contact: ${escapeXml(s.guardianPhone)}`);
  if (s.birthdate) bodyLines.push(`Birthdate: ${escapeXml(s.birthdate)}`);
  if (s.medicalLine) bodyLines.push(`Medical / allergy info: ${escapeXml(s.medicalLine)}`);
  if (s.notesLine) bodyLines.push(`Note: ${escapeXml(s.notesLine)}`);

  const body = bodyLines
    .map((line, i) => {
      const wrapped = wrapLines(line, 52, 2);
      return wrapped
        .map(
          (part, j) =>
            `<text x="16" y="${88 + i * 22 + j * 16}" font-family="${BADGE_PRINT_FONT_FAMILY}" font-size="11" font-weight="600" fill="#1e293b">${part}</text>`,
        )
        .join("\n");
    })
    .join("\n");

  const footerQr =
    payload.qrDataUrl && payload.settings.showQrCode
      ? `<image href="${payload.qrDataUrl}" x="${w / 2 - 28}" y="${h - 72}" width="56" height="56" />`
      : payload.barcodeDataUrl
        ? `<image href="${payload.barcodeDataUrl}" x="16" y="${h - 56}" width="${w - 32}" height="28" preserveAspectRatio="xMidYMid meet" />`
        : "";

  const timestamp = s.printedAt
    ? `<text x="${w / 2}" y="${h - 82}" text-anchor="middle" font-family="${BADGE_PRINT_FONT_FAMILY}" font-size="9" fill="#64748b">${escapeXml(s.printedAt)}</text>`
    : "";

  return `
    <text x="16" y="42" font-family="${BADGE_PRINT_FONT_FAMILY}" font-size="22" font-weight="800" fill="#0f172a">${name}</text>
    ${code}
    <line x1="16" y1="58" x2="${w - 16}" y2="58" stroke="#0f172a" stroke-width="2" />
    ${body}
    ${timestamp}
    ${footerQr}
  `;
}

export function buildBadgePrintSvg(payload: BadgePrintPayload): string {
  const dims = badgeLabelPageCss(payload.settings.labelSize, payload.settings.orientation);
  const px = labelPixels(payload.settings.labelSize);
  const w = dims.isHorizontal ? px.height : px.width;
  const h = dims.isHorizontal ? px.width : px.height;

  const layout = payload.settings.horizontalLayout;
  const inner =
    dims.isHorizontal && layout === "KIDCHECK"
      ? renderKidCheck(payload, w, h)
      : dims.isHorizontal && layout === "NAME_CODE_HEADER"
        ? renderKidCheck(payload, w, h)
        : renderStandardVertical(payload, w, h);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="100%" height="100%" fill="#ffffff"/>
  ${inner}
</svg>`;
}

export async function renderBadgePngBuffer(payload: BadgePrintPayload): Promise<Buffer> {
  const { Resvg } = await import("@resvg/resvg-js");
  const svg = buildBadgePrintSvg(payload);
  const resvg = new Resvg(svg, {
    font: {
      fontFiles: badgePrintFontFiles(),
      loadSystemFonts: false,
      defaultFontFamily: BADGE_PRINT_FONT_FAMILY,
    },
  });
  return Buffer.from(resvg.render().asPng());
}
