import type { BadgePrintPayload } from "@/lib/badge-print";
import {
  badgeFormFieldFontPt,
  badgeLabelPageCss,
  type BadgeDetailFieldId,
  type BadgeTypographySettings,
} from "@/lib/badge-print";
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
 * Mobile check-in uses 62 mm media; render at printable dot width (696), not landscape pixels.
 *
 * Horizontal badges are DRAWN landscape (long edge = label length, e.g. 100 mm on DK-1202
 * 62×100 die-cut), then the final SVG is rotated 90° so the PNG sent to the printer is
 * portrait (tape width × label length) and fills the whole label — Planning Center style.
 */
function brotherQlCanvas(
  labelSize: BadgePrintPayload["settings"]["labelSize"],
  orientation: BadgePrintPayload["settings"]["orientation"],
): LabelCanvas {
  const base = labelBaseInches(labelSize);
  const horizontal = orientation === "HORIZONTAL";

  const tapePx =
    labelSize === "LABEL_4X6"
      ? Math.round(base.widthIn * BADGE_RENDER_DPI)
      : BROTHER_QL_62MM_PRINTABLE_WIDTH;

  if (horizontal) {
    // Landscape drawing canvas: rotated to portrait at SVG output time.
    return {
      w: Math.round(base.heightIn * BADGE_RENDER_DPI),
      h: tapePx,
      widthIn: base.heightIn,
      heightIn: base.widthIn,
      horizontal,
    };
  }

  return {
    w: tapePx,
    h: Math.round(base.heightIn * BADGE_RENDER_DPI),
    widthIn: base.widthIn,
    heightIn: base.heightIn,
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

/** Keep emergency phone intact — label on one line, full number on the next if needed. */
function wrapKidCheckLine(text: string, maxChars: number, maxLines: number): string[] {
  if (text.startsWith("Emergency contact:")) {
    const phone = text.slice("Emergency contact:".length).trim();
    const prefix = "Emergency contact:";
    const combined = `${prefix} ${phone}`;
    if (combined.length <= maxChars) return [combined];
    if (maxLines >= 2 && phone.length <= maxChars) return [prefix, phone];
    return wrapLines(combined, maxChars, Math.min(maxLines, 2));
  }
  return wrapLines(text, maxChars, maxLines);
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
              : line.kind === "formField" && line.fontPt
                ? ptToPx(line.fontPt, canvas)
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

  type BodyLine = KidCheckBodyLine;
  const bodyLines: BodyLine[] = kidCheckBodyLines(payload);
  const typography = payload.settings.typography;

  let bodyY = dividerY + inchToPx(0.06, canvas);
  const bodyParts: string[] = [];
  for (const line of bodyLines) {
    const size =
      line.kind === "season" ? seasonSize : line.kind === "class" ? classSize : lineSize;
    const fill = line.kind === "season" ? "#64748b" : "#1e293b";
    const maxChars = Math.max(24, Math.floor((w - pad * 2) / (size * 0.55)));
    const block = renderKidCheckBodyLineBlock(
      line,
      pad,
      bodyY,
      size,
      fill,
      typography,
      maxChars,
      2,
      wrapGap,
    );
    bodyParts.push(...block.parts);
    bodyY = block.endY + lineGap;
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

type KidCheckBodyLine = {
  kind: "season" | "class" | "detail";
  label?: string;
  value: string;
  fontPt?: number;
};

function kidCheckDetailFontWeight(typography: BadgeTypographySettings, part: "label" | "value"): number {
  return part === "label"
    ? typography.detailLabelBold
      ? 700
      : 400
    : typography.detailValueBold
      ? 700
      : 400;
}

function kidCheckBodyLineCombinedText(line: KidCheckBodyLine): string {
  if (line.label) return `${line.label} ${line.value}`.trim();
  return line.value;
}

function renderKidCheckBodyLineSvg(
  line: KidCheckBodyLine,
  x: number,
  y: number,
  size: number,
  fill: string,
  typography: BadgeTypographySettings,
  maxChars: number,
  maxLines: number,
): string {
  if (line.kind === "class") {
    return `<text x="${x}" y="${y}" font-family="${BADGE_PRINT_FONT_FAMILY}" font-size="${size}" font-weight="800" fill="${fill}">${line.value}</text>`;
  }
  if (line.kind === "season") {
    return `<text x="${x}" y="${y}" font-family="${BADGE_PRINT_FONT_FAMILY}" font-size="${size}" font-weight="600" fill="${fill}">${line.value}</text>`;
  }

  const labelWeight = kidCheckDetailFontWeight(typography, "label");
  const valueWeight = kidCheckDetailFontWeight(typography, "value");
  const combined = kidCheckBodyLineCombinedText(line);
  const wrapped = wrapKidCheckLine(combined, maxChars, maxLines);

  const segment = wrapped[0];
  if (!line.label) {
    return `<text x="${x}" y="${y}" font-family="${BADGE_PRINT_FONT_FAMILY}" font-size="${size}" font-weight="${valueWeight}" fill="${fill}">${segment}</text>`;
  }

  if (segment === line.label) {
    return `<text x="${x}" y="${y}" font-family="${BADGE_PRINT_FONT_FAMILY}" font-size="${size}" fill="${fill}"><tspan font-weight="${labelWeight}">${line.label}</tspan></text>`;
  }

  if (segment.startsWith(line.label)) {
    const rest = segment.slice(line.label.length).trimStart();
    if (!rest) {
      return `<text x="${x}" y="${y}" font-family="${BADGE_PRINT_FONT_FAMILY}" font-size="${size}" fill="${fill}"><tspan font-weight="${labelWeight}">${line.label}</tspan></text>`;
    }
    return `<text x="${x}" y="${y}" font-family="${BADGE_PRINT_FONT_FAMILY}" font-size="${size}" fill="${fill}"><tspan font-weight="${labelWeight}">${line.label}</tspan><tspan font-weight="${valueWeight}"> ${rest}</tspan></text>`;
  }

  return `<text x="${x}" y="${y}" font-family="${BADGE_PRINT_FONT_FAMILY}" font-size="${size}" font-weight="${valueWeight}" fill="${fill}">${segment}</text>`;
}

function renderKidCheckBodyLineBlock(
  line: KidCheckBodyLine,
  x: number,
  startY: number,
  size: number,
  fill: string,
  typography: BadgeTypographySettings,
  maxChars: number,
  maxLines: number,
  wrapGap: number,
): { parts: string[]; endY: number } {
  if (line.kind === "class" || line.kind === "season" || !line.label) {
    const combined = kidCheckBodyLineCombinedText(line);
    const wrapped =
      line.kind === "detail" && !line.label
        ? wrapLines(combined, maxChars, maxLines)
        : [combined];
    const parts: string[] = [];
    let y = startY;
    for (let j = 0; j < wrapped.length; j++) {
      y += size + (j === 0 ? 0 : wrapGap);
      const segmentLine: KidCheckBodyLine =
        j === 0 ? line : { kind: "detail", value: wrapped[j] };
      parts.push(
        renderKidCheckBodyLineSvg(segmentLine, x, y, size, fill, typography, maxChars, maxLines),
      );
    }
    return { parts, endY: y };
  }

  const combined = kidCheckBodyLineCombinedText(line);
  const wrapped = wrapKidCheckLine(combined, maxChars, maxLines);
  const parts: string[] = [];
  let y = startY;
  for (let j = 0; j < wrapped.length; j++) {
    y += size + (j === 0 ? 0 : wrapGap);
    const segment = wrapped[j];
    if (j === 0 && segment === line.label) {
      parts.push(
        `<text x="${x}" y="${y}" font-family="${BADGE_PRINT_FONT_FAMILY}" font-size="${size}" fill="${fill}"><tspan font-weight="${kidCheckDetailFontWeight(typography, "label")}">${line.label}</tspan></text>`,
      );
      continue;
    }
    if (j === 0 && segment.startsWith(line.label)) {
      const rest = segment.slice(line.label.length).trimStart();
      const labelWeight = kidCheckDetailFontWeight(typography, "label");
      const valueWeight = kidCheckDetailFontWeight(typography, "value");
      parts.push(
        rest
          ? `<text x="${x}" y="${y}" font-family="${BADGE_PRINT_FONT_FAMILY}" font-size="${size}" fill="${fill}"><tspan font-weight="${labelWeight}">${line.label}</tspan><tspan font-weight="${valueWeight}"> ${rest}</tspan></text>`
          : `<text x="${x}" y="${y}" font-family="${BADGE_PRINT_FONT_FAMILY}" font-size="${size}" fill="${fill}"><tspan font-weight="${labelWeight}">${line.label}</tspan></text>`,
      );
      continue;
    }
    parts.push(
      `<text x="${x}" y="${y}" font-family="${BADGE_PRINT_FONT_FAMILY}" font-size="${size}" font-weight="${kidCheckDetailFontWeight(typography, "value")}" fill="${fill}">${segment}</text>`,
    );
  }
  return { parts, endY: y };
}

function kidCheckBodyLines(payload: BadgePrintPayload): KidCheckBodyLine[] {
  const s = payload.structured;
  const settings = payload.settings;
  const detailPt = (fieldKey: string) => badgeFormFieldFontPt(settings, fieldKey);

  const blocks: Record<BadgeDetailFieldId, KidCheckBodyLine[]> = {
    season: s.seasonLine ? [{ kind: "season", value: escapeXml(s.seasonLine) }] : [],
    class: s.classLine
      ? [{ kind: "class", value: escapeXml(s.classLine) }]
      : s.serviceLine
        ? [{ kind: "class", value: escapeXml(s.serviceLine) }]
        : [],
    allergyFlag: s.medicalLine
      ? [
          {
            kind: "detail",
            label: "Allergies:",
            value: escapeXml(s.medicalLine),
            fontPt: settings.typography.detailPt,
          },
        ]
      : [],
    formFields: s.answerLines.flatMap((line) => {
      const label = line.label?.trim();
      const text = line.text.trim();
      if (!text) return [];
      return [
        {
          kind: "detail" as const,
          label: label ? `${label}:` : undefined,
          value: escapeXml(text),
          fontPt:
            line.fontPt ??
            (line.fieldKey ? detailPt(line.fieldKey) : settings.typography.detailPt),
        },
      ];
    }),
  };

  const order = settings.typography.detailFieldOrder;
  const lines: KidCheckBodyLine[] = [];
  for (const blockId of order) {
    lines.push(...(blocks[blockId] ?? []));
  }
  return lines;
}

/** Brother horizontal badges: pt sizes from season badge typography settings. */
function brotherHorPt(payload: BadgePrintPayload) {
  return payload.settings.typography;
}

/** Brother 62 mm media: text block left, QR right — drawn landscape, rotated at output. */
function renderKidCheckBrotherWide(payload: BadgePrintPayload, canvas: LabelCanvas): string {
  const { w, h } = canvas;
  const s = payload.structured;
  const t = brotherHorPt(payload);
  const name = escapeXml(`${s.firstName} ${s.lastName}`.trim() || payload.childName);

  const pad = inchToPx(0.1, canvas);
  const nameSize = ptToPx(t.namePt, canvas);
  const codeSize = ptToPx(t.codePt, canvas);
  const classSize = ptToPx(t.classPt, canvas);
  const lineSize = ptToPx(t.detailPt, canvas);
  const seasonSize = ptToPx(t.seasonPt, canvas);
  const timestampSize = ptToPx(t.timestampPt, canvas);
  const lineGap = inchToPx(t.lineGapIn, canvas);
  const wrapGap = inchToPx(t.wrapGapIn, canvas);
  const stroke = Math.max(2, Math.round(inchToPx(0.018, canvas)));
  const qrSize = inchToPx(t.qrSizeIn, canvas);

  const stripW = payload.settings.logoUrl ? inchToPx(0.28, canvas) : 0;
  const stripX = w - pad - stripW;
  const qrX = stripX - (stripW ? inchToPx(0.04, canvas) : 0) - qrSize;
  const textMaxX = qrX - inchToPx(0.06, canvas);

  const codePadY = inchToPx(0.016, canvas);
  const codeText = s.securityCode ? escapeXml(s.securityCode) : "";
  const codeBoxW = qrSize;
  const codeBoxH = codeText ? codeSize + codePadY * 2 : 0;
  const codeBoxX = qrX;
  const code = codeText
    ? `<rect x="${codeBoxX}" y="${pad}" width="${codeBoxW}" height="${codeBoxH}" fill="#0f172a" rx="2"/>
       <text x="${codeBoxX + codeBoxW / 2}" y="${pad + codePadY + codeSize * 0.82}" text-anchor="middle" font-family="${BADGE_PRINT_FONT_FAMILY}" font-size="${codeSize}" font-weight="800" fill="#ffffff">${codeText}</text>`
    : "";

  const nameY = pad + nameSize;
  const dividerY = nameY + inchToPx(0.05, canvas);
  const qrY = codeText ? pad + codeBoxH + inchToPx(0.04, canvas) : dividerY;

  let bodyY = dividerY + inchToPx(0.055, canvas);
  const bodyParts: string[] = [];
  const maxChars = Math.max(18, Math.floor((textMaxX - pad) / (lineSize * 0.55)));
  const bodyBottom = h - pad - (s.printedAt ? timestampSize + inchToPx(0.04, canvas) : 0);
  const typography = payload.settings.typography;
  for (const line of kidCheckBodyLines(payload)) {
    const size =
      line.kind === "season"
        ? seasonSize
        : line.kind === "class"
          ? classSize
          : ptToPx(line.fontPt ?? t.detailPt, canvas);
    const fill = line.kind === "season" ? "#64748b" : "#1e293b";
    const block = renderKidCheckBodyLineBlock(
      line,
      pad,
      bodyY,
      size,
      fill,
      typography,
      maxChars,
      4,
      wrapGap,
    );
    if (block.endY > bodyBottom) break;
    bodyParts.push(...block.parts);
    bodyY = block.endY + lineGap;
    if (bodyY > bodyBottom) break;
  }

  const timestampY = Math.min(bodyY + timestampSize + inchToPx(0.025, canvas), bodyBottom);
  const timestamp = s.printedAt
    ? `<text x="${pad}" y="${timestampY}" font-family="${BADGE_PRINT_FONT_FAMILY}" font-size="${timestampSize}" fill="#64748b">${escapeXml(s.printedAt)}</text>`
    : "";

  const footerQr =
    payload.qrDataUrl && payload.settings.showQrCode
      ? `<image href="${payload.qrDataUrl}" x="${qrX}" y="${qrY}" width="${qrSize}" height="${qrSize}" />`
      : payload.barcodeDataUrl
        ? `<image href="${payload.barcodeDataUrl}" x="${qrX}" y="${qrY}" width="${qrSize}" height="${inchToPx(0.2, canvas)}" preserveAspectRatio="xMidYMid meet" />`
        : "";

  const logoImgW = inchToPx(0.55, canvas);
  const logoImgH = stripW ? stripW * 0.82 : 0;
  const logoStrip = payload.settings.logoUrl
    ? `<line x1="${stripX}" y1="${pad}" x2="${stripX}" y2="${h - pad}" stroke="#cbd5e1" stroke-width="${Math.max(1, Math.round(inchToPx(0.004, canvas)))}" />
       <g transform="translate(${stripX + stripW / 2} ${h / 2}) rotate(-90)">
         <image href="${payload.settings.logoUrl}" x="${-logoImgW / 2}" y="${-logoImgH / 2}" width="${logoImgW}" height="${logoImgH}" preserveAspectRatio="xMidYMid meet" />
       </g>`
    : "";

  const bodyClip = `<clipPath id="kidcheck-body-clip"><rect x="0" y="${dividerY}" width="${textMaxX}" height="${h - dividerY}" /></clipPath>`;

  return `
    ${bodyClip}
    <text x="${pad}" y="${nameY}" font-family="${BADGE_PRINT_FONT_FAMILY}" font-size="${nameSize}" font-weight="800" fill="#0f172a">${name}</text>
    ${code}
    <line x1="${pad}" y1="${dividerY}" x2="${textMaxX}" y2="${dividerY}" stroke="#0f172a" stroke-width="${stroke}" />
    <g clip-path="url(#kidcheck-body-clip)">
      ${bodyParts.join("\n")}
      ${timestamp}
    </g>
    ${footerQr}
    ${logoStrip}
  `;
}

/** Brother 62 mm: Name + code header — matches admin preview (not KidCheck). */
function renderNameCodeHeaderBrotherWide(payload: BadgePrintPayload, canvas: LabelCanvas): string {
  const { w, h } = canvas;
  const s = payload.structured;
  const t = brotherHorPt(payload);
  const typography = t;
  const pad = inchToPx(0.1, canvas);
  const nameSize = ptToPx(t.namePt, canvas);
  const lastNameSize = ptToPx(t.detailPt, canvas);
  const codeSize = ptToPx(t.codePt, canvas);
  const classSize = ptToPx(t.classPt, canvas);
  const detailSize = ptToPx(t.detailPt, canvas);
  const lineGap = inchToPx(t.lineGapIn, canvas);
  const wrapGap = inchToPx(t.wrapGapIn, canvas);
  const stroke = Math.max(2, Math.round(inchToPx(0.018, canvas)));
  const qrSize = inchToPx(t.qrSizeIn, canvas);

  const rightColW = Math.max(qrSize, inchToPx(0.85, canvas));
  const rightX = w - pad - rightColW;
  const textMaxX = rightX - inchToPx(0.08, canvas);

  const codePadY = inchToPx(0.014, canvas);
  const codeLabelSize = ptToPx(Math.max(6, t.seasonPt), canvas);
  const codeText = s.securityCode ? escapeXml(s.securityCode) : "";
  const codeBoxW = rightColW;
  const codeLabelH = codeText ? codeLabelSize + codePadY : 0;
  const codeValueH = codeText ? codeSize + codePadY : 0;
  const codeBoxH = codeText ? codeLabelH + codeValueH : 0;

  let rightY = pad;
  const codeParts: string[] = [];
  if (codeText) {
    codeParts.push(
      `<rect x="${rightX}" y="${pad}" width="${codeBoxW}" height="${codeBoxH}" fill="#0f172a" rx="2"/>`,
      `<text x="${rightX + codeBoxW / 2}" y="${pad + codePadY + codeLabelSize * 0.85}" text-anchor="middle" font-family="${BADGE_PRINT_FONT_FAMILY}" font-size="${codeLabelSize}" font-weight="700" fill="#ffffff" opacity="0.85">CODE</text>`,
      `<text x="${rightX + codeBoxW / 2}" y="${pad + codeLabelH + codeSize * 0.85}" text-anchor="middle" font-family="${BADGE_PRINT_FONT_FAMILY}" font-size="${codeSize}" font-weight="800" fill="#ffffff">${codeText}</text>`,
    );
    rightY = pad + codeBoxH + inchToPx(0.04, canvas);
  }

  const qrY = rightY;
  const footerQr =
    payload.qrDataUrl && payload.settings.showQrCode
      ? `<image href="${payload.qrDataUrl}" x="${rightX + (codeBoxW - qrSize) / 2}" y="${qrY}" width="${qrSize}" height="${qrSize}" />`
      : "";

  let leftY = pad;
  const leftParts: string[] = [];
  if (payload.settings.showChildName && s.firstName) {
    leftY += nameSize;
    leftParts.push(
      `<text x="${pad}" y="${leftY}" font-family="${BADGE_PRINT_FONT_FAMILY}" font-size="${nameSize}" font-weight="800" fill="#0f172a">${escapeXml(s.firstName || payload.childName)}</text>`,
    );
  }
  if (payload.settings.showChildName && s.lastName) {
    leftY += lastNameSize + lineGap * 0.5;
    leftParts.push(
      `<text x="${pad}" y="${leftY}" font-family="${BADGE_PRINT_FONT_FAMILY}" font-size="${lastNameSize}" font-weight="700" fill="#1e293b">${escapeXml(s.lastName)}</text>`,
    );
  }

  const dividerY = Math.max(leftY + inchToPx(0.045, canvas), qrY + qrSize + inchToPx(0.02, canvas));
  leftParts.push(
    `<line x1="${pad}" y1="${dividerY}" x2="${textMaxX}" y2="${dividerY}" stroke="#0f172a" stroke-width="${stroke}" />`,
  );

  let bodyY = dividerY + inchToPx(0.055, canvas);
  const bodyParts: string[] = [];
  const maxChars = Math.max(16, Math.floor((textMaxX - pad) / (detailSize * 0.55)));
  const bodyBottom = h - pad;

  if (s.locationLine) {
    const wrapped = wrapLines(escapeXml(s.locationLine), maxChars, 3);
    for (let j = 0; j < wrapped.length; j++) {
      bodyY += classSize + (j === 0 ? 0 : wrapGap);
      bodyParts.push(
        `<text x="${pad}" y="${bodyY}" font-family="${BADGE_PRINT_FONT_FAMILY}" font-size="${classSize}" font-weight="800" fill="#0f172a">${wrapped[j]}</text>`,
      );
    }
    bodyY += lineGap;
  }

  for (const line of s.answerLines) {
    const label = line.label?.trim();
    const value = line.text.trim();
    if (!value) continue;
    const size = ptToPx(line.fontPt ?? t.detailPt, canvas);
    const bodyLine: KidCheckBodyLine = {
      kind: "detail",
      label: label ? `${label}:` : undefined,
      value: escapeXml(value),
      fontPt: line.fontPt,
    };
    const block = renderKidCheckBodyLineBlock(
      bodyLine,
      pad,
      bodyY,
      size,
      "#1e293b",
      typography,
      maxChars,
      3,
      wrapGap,
    );
    if (block.endY > bodyBottom) break;
    bodyParts.push(...block.parts);
    bodyY = block.endY + lineGap;
  }

  if (s.medicalLine) {
    const bodyLine: KidCheckBodyLine = {
      kind: "detail",
      label: "Allergies:",
      value: escapeXml(s.medicalLine),
    };
    const block = renderKidCheckBodyLineBlock(
      bodyLine,
      pad,
      bodyY,
      detailSize,
      "#1e293b",
      typography,
      maxChars,
      2,
      wrapGap,
    );
    bodyParts.push(...block.parts);
  }

  const bodyClip = `<clipPath id="name-code-body-clip"><rect x="0" y="${dividerY}" width="${textMaxX}" height="${h - dividerY}" /></clipPath>`;

  return `
    ${bodyClip}
    ${leftParts.join("\n")}
    ${codeParts.join("\n")}
    ${footerQr}
    <g clip-path="url(#name-code-body-clip)">
      ${bodyParts.join("\n")}
    </g>
  `;
}

function renderStandardBrotherWide(payload: BadgePrintPayload, canvas: LabelCanvas): string {
  const { w } = canvas;
  const t = brotherHorPt(payload);
  const pad = inchToPx(0.1, canvas);
  const qrSize = inchToPx(t.qrSizeIn, canvas);
  const qrX = w - pad - qrSize;
  const textMaxX = qrX - inchToPx(0.06, canvas);
  const lineGap = inchToPx(t.lineGapIn, canvas);

  let y = pad + ptToPx(t.namePt, canvas);
  const lines = payload.lines
    .map((line) => {
      const size =
        line.kind === "name"
          ? ptToPx(t.namePt, canvas)
          : line.kind === "season"
            ? ptToPx(t.seasonPt, canvas)
            : line.kind === "number"
              ? ptToPx(t.codePt, canvas)
              : line.kind === "class" || line.kind === "badgeName"
                ? ptToPx(t.classPt, canvas)
                : line.kind === "allergy"
                  ? ptToPx(t.seasonPt, canvas)
                  : line.kind === "formField"
                    ? ptToPx(line.fontPt ?? t.detailPt, canvas)
                    : ptToPx(t.detailPt, canvas);
      const weight = line.kind === "name" || line.kind === "number" ? 700 : 600;
      const fill = line.kind === "allergy" ? "#b45309" : "#0f172a";
      const lineY = y + size;
      y += size + lineGap;
      return `<text x="${pad}" y="${lineY}" font-family="${BADGE_PRINT_FONT_FAMILY}" font-size="${size}" font-weight="${weight}" fill="${fill}">${escapeXml(line.text)}</text>`;
    })
    .join("\n");

  const bodyClip = `<clipPath id="standard-body-clip"><rect x="0" y="0" width="${textMaxX}" height="${canvas.h}" /></clipPath>`;
  const qrY = pad + ptToPx(t.namePt, canvas) + inchToPx(0.04, canvas);
  const qr =
    payload.qrDataUrl && payload.settings.showQrCode
      ? `<image href="${payload.qrDataUrl}" x="${qrX}" y="${qrY}" width="${qrSize}" height="${qrSize}" />`
      : "";

  return `${bodyClip}<g clip-path="url(#standard-body-clip)">${lines}</g>${qr}`;
}

function resolveBadgeRenderCanvas(
  payload: BadgePrintPayload,
  options: BadgePngRenderOptions,
): LabelCanvas {
  return options.brotherQl
    ? brotherQlCanvas(payload.settings.labelSize, payload.settings.orientation)
    : labelCanvas(payload.settings.labelSize, payload.settings.orientation);
}

export function buildBadgePrintSvg(
  payload: BadgePrintPayload,
  options: BadgePngRenderOptions = {},
): string {
  const dims = badgeLabelPageCss(payload.settings.labelSize, payload.settings.orientation);
  const canvas = resolveBadgeRenderCanvas(payload, options);
  const { w, h } = canvas;

  const layout = payload.settings.horizontalLayout;
  const inner = dims.isHorizontal
    ? layout === "STANDARD"
      ? renderStandardBrotherWide(payload, canvas)
      : layout === "NAME_CODE_HEADER"
        ? renderNameCodeHeaderBrotherWide(payload, canvas)
        : renderKidCheckBrotherWide(payload, canvas)
    : renderStandardVertical(payload, canvas);

  if (options.brotherQl && dims.isHorizontal) {
    // Rotate the landscape badge 90° into a portrait PNG (tape width × label length).
    // The printer fills the die-cut 62×100 label; the badge reads horizontally when worn.
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${h}" height="${w}" viewBox="0 0 ${h} ${w}">
  <rect width="100%" height="100%" fill="#ffffff"/>
  <g transform="translate(${h} 0) rotate(90)">
  ${inner}
  </g>
</svg>`;
  }

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

async function resolveLogoDataUrl(logoUrl: string | null): Promise<string | null> {
  if (!logoUrl?.trim()) return null;
  const url = logoUrl.trim();
  if (url.startsWith("data:")) return url;

  try {
    let buffer: Buffer;
    let mime = "image/png";
    if (/^https?:\/\//i.test(url)) {
      const res = await fetch(url);
      if (!res.ok) return null;
      buffer = Buffer.from(await res.arrayBuffer());
      mime = res.headers.get("content-type")?.split(";")[0]?.trim() || mime;
    } else if (url.startsWith("/")) {
      const { readFile } = await import("fs/promises");
      const path = await import("path");
      buffer = await readFile(path.join(process.cwd(), "public", url.replace(/^\//, "")));
      const ext = path.extname(url).toLowerCase();
      if (ext === ".webp") mime = "image/webp";
      else if (ext === ".jpg" || ext === ".jpeg") mime = "image/jpeg";
      else if (ext === ".gif") mime = "image/gif";
    } else {
      return null;
    }
    return `data:${mime};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
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

  const logoDataUrl = await resolveLogoDataUrl(payload.settings.logoUrl);
  const renderPayload: BadgePrintPayload = logoDataUrl
    ? { ...payload, settings: { ...payload.settings, logoUrl: logoDataUrl } }
    : payload;

  const canvas = resolveBadgeRenderCanvas(renderPayload, options);

  const { Resvg } = await import("@resvg/resvg-js");
  const svg = buildBadgePrintSvg(renderPayload, options);
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

  // Horizontal Brother badges are rotated to portrait at output (see buildBadgePrintSvg).
  const dims = badgeLabelPageCss(payload.settings.labelSize, payload.settings.orientation);
  if (options.brotherQl && dims.isHorizontal) {
    return { png, width: canvas.h, height: canvas.w };
  }

  return { png, width: canvas.w, height: canvas.h };
}
