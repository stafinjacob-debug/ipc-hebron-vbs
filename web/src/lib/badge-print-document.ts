import type { BadgePrintPayload } from "@/lib/badge-print";
import { badgeLabelPageCss } from "@/lib/badge-print";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function lineClass(kind: BadgePrintPayload["lines"][number]["kind"]): string {
  switch (kind) {
    case "season":
      return "line season";
    case "name":
      return "line name";
    case "number":
      return "line number";
    case "allergy":
      return "line allergy";
    case "formField":
      return "line custom";
    default:
      return "line detail";
  }
}

function renderLine(line: BadgePrintPayload["lines"][number]): string {
  const text = escapeHtml(line.text);
  if (line.kind === "formField" && line.label) {
    const textStyle = line.fontPt ? ` style="font-size:${line.fontPt}pt"` : "";
    return `<div class="${lineClass(line.kind)}"><span class="custom-label">${escapeHtml(line.label)}</span><span class="custom-text"${textStyle}>${text}</span></div>`;
  }
  if (line.kind === "formField" && line.fontPt) {
    return `<div class="${lineClass(line.kind)}" style="font-size:${line.fontPt}pt">${text}</div>`;
  }
  return `<div class="${lineClass(line.kind)}">${text}</div>`;
}

function renderStandardVertical(payload: BadgePrintPayload): string {
  const linesHtml = payload.lines.map(renderLine).join("");
  const logoHtml = payload.settings.logoUrl
    ? `<img class="logo" src="${escapeHtml(payload.settings.logoUrl)}" alt="" />`
    : "";
  const qrHtml =
    payload.qrDataUrl && payload.settings.showQrCode
      ? `<div class="qr-wrap"><img class="qr" src="${payload.qrDataUrl}" alt="Check-in QR code" /></div>`
      : "";
  return `<div class="badge vertical">${logoHtml}${linesHtml}${qrHtml}</div>`;
}

function renderStandardHorizontal(payload: BadgePrintPayload): string {
  return renderVbsHorizontal(payload);
}

function renderVbsHorizontal(payload: BadgePrintPayload): string {
  const s = payload.structured;
  const t = payload.settings.typography;

  const rightParts: string[] = [];
  if (s.securityCode) {
    rightParts.push(
      `<div class="vbs-reg-number" style="font-size:${t.codePt}pt">${escapeHtml(s.securityCode)}</div>`,
    );
  }
  if (payload.qrDataUrl && payload.settings.showQrCode) {
    rightParts.push(
      `<img class="vbs-qr" src="${payload.qrDataUrl}" alt="Check-in QR code" style="width:${t.qrSizeIn}in;height:${t.qrSizeIn}in" />`,
    );
  }
  if (s.printedAt) {
    rightParts.push(
      `<div class="vbs-timestamp" style="font-size:${t.timestampPt}pt">${escapeHtml(s.printedAt)}</div>`,
    );
  }

  return `<div class="badge horizontal layout-vbs">
    <div class="vbs-left">
      ${s.childNameLine ? `<div class="vbs-child-name" style="font-size:${t.namePt}pt">${escapeHtml(s.childNameLine)}</div>` : ""}
      ${s.eventLine ? `<div class="vbs-event" style="font-size:${t.seasonPt}pt">${escapeHtml(s.eventLine)}</div>` : ""}
      ${s.classLine ? `<div class="vbs-class" style="font-size:${t.classPt}pt">${escapeHtml(s.classLine)}</div>` : ""}
      ${s.tShirtSizeLine ? `<div class="vbs-tshirt" style="font-size:${t.detailPt}pt">${escapeHtml(s.tShirtSizeLine)}</div>` : ""}
      ${s.guardianLine ? `<div class="vbs-guardian" style="font-size:${t.detailPt}pt">${escapeHtml(s.guardianLine)}</div>` : ""}
      ${s.guardianPhone ? `<div class="vbs-phone" style="font-size:${t.detailPt}pt">${escapeHtml(s.guardianPhone)}</div>` : ""}
    </div>
    <div class="vbs-right">${rightParts.join("")}</div>
  </div>`;
}

function renderNameCodeHeader(payload: BadgePrintPayload): string {
  return renderVbsHorizontal(payload);
}

function detailLineHtml(
  label: string,
  value: string,
  typography: BadgePrintPayload["settings"]["typography"],
  fontPt?: number,
): string {
  const labelWeight = typography.detailLabelBold ? 700 : 400;
  const valueWeight = typography.detailValueBold ? 700 : 400;
  const style = fontPt ? ` style="font-size:${fontPt}pt"` : "";
  return `<div class="kidcheck-line"${style}><span style="font-weight:${labelWeight}">${escapeHtml(label)}</span> <span style="font-weight:${valueWeight}">${escapeHtml(value)}</span></div>`;
}

function renderKidCheck(payload: BadgePrintPayload): string {
  return renderVbsHorizontal(payload);
}

function layoutCss(horizontal: boolean): string {
  const base = `
    .badge { width: VAR_WIDTH; height: VAR_HEIGHT; padding: 0.1in; overflow: hidden; }
    .badge.vertical { display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 0.05in; }
    .badge.horizontal.standard { display: flex; flex-direction: row; align-items: center; justify-content: space-between; gap: 0.08in; }
    .badge-main { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: flex-start; justify-content: center; text-align: left; gap: 0.03in; }
    .badge-main .lines { display: flex; flex-direction: column; gap: 0.02in; width: 100%; }
    .badge-side { flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
    .logo { max-width: ${horizontal ? "0.75in" : "0.9in"}; max-height: ${horizontal ? "0.35in" : "0.45in"}; object-fit: contain; }
    .line.season { font-size: ${horizontal ? "7pt" : "9pt"}; font-weight: 600; letter-spacing: 0.02em; text-transform: uppercase; color: #334155; }
    .line.name { font-size: ${horizontal ? "13pt" : "18pt"}; font-weight: 800; line-height: 1.05; }
    .line.number { font-size: ${horizontal ? "9pt" : "11pt"}; font-weight: 700; font-variant-numeric: tabular-nums; letter-spacing: 0.04em; }
    .line.detail { font-size: ${horizontal ? "9pt" : "11pt"}; font-weight: 600; color: #1e293b; }
    .line.allergy { font-size: ${horizontal ? "7pt" : "9pt"}; font-weight: 700; color: #b45309; text-transform: uppercase; letter-spacing: 0.04em; }
    .line.custom { display: flex; flex-direction: column; gap: 0.01in; }
    .custom-label { font-size: ${horizontal ? "6.5pt" : "8pt"}; font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em; color: #64748b; }
    .custom-text { font-size: ${horizontal ? "8.5pt" : "10pt"}; font-weight: 600; color: #1e293b; }
    .qr-wrap { margin-top: ${horizontal ? "0" : "0.04in"}; }
    .qr { width: ${horizontal ? "0.78in" : "0.95in"}; height: ${horizontal ? "0.78in" : "0.95in"}; display: block; }
  `;

  const nameCode = `
    .layout-name-code { display: flex; flex-direction: column; gap: 0.04in; text-align: left; }
    .header-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 0.08in; }
    .name-stack { min-width: 0; flex: 1; }
    .first-name { font-size: 16pt; font-weight: 800; line-height: 1; letter-spacing: -0.01em; }
    .last-name { margin-top: 0.02in; font-size: 12pt; font-weight: 700; line-height: 1.05; }
    .header-right { flex-shrink: 0; display: flex; flex-direction: column; align-items: flex-end; gap: 0.03in; max-width: 42%; }
    .code-box { background: #0f172a; color: #fff; padding: 0.03in 0.05in; border-radius: 2px; text-align: center; min-width: 0.75in; }
    .code-label { display: block; font-size: 6pt; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; opacity: 0.85; }
    .code-value { display: block; font-size: 9pt; font-weight: 800; font-variant-numeric: tabular-nums; letter-spacing: 0.03em; }
    .checkin-meta { font-size: 6.5pt; line-height: 1.25; color: #475569; text-align: right; }
    .divider { border: 0; border-top: 1.5px solid #0f172a; margin: 0.02in 0; }
    .location-line { font-size: 11pt; font-weight: 800; line-height: 1.15; color: #0f172a; }
    .detail-block { margin-top: 0.02in; }
    .detail-label { display: block; font-size: 6.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; }
    .detail-text { font-size: 8pt; font-weight: 600; line-height: 1.25; color: #1e293b; }
    .header-qr { width: 0.55in; height: 0.55in; display: block; margin-top: 0.02in; }
  `;

  const kidcheck = `
    .layout-kidcheck { display: flex; flex-direction: row; align-items: stretch; gap: 0.04in; }
    .kidcheck-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.025in; }
    .kidcheck-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 0.06in; }
    .kidcheck-name { font-size: 13pt; font-weight: 800; line-height: 1.05; flex: 1; min-width: 0; }
    .security-code { flex-shrink: 0; border: 1.5px solid #0f172a; padding: 0.02in 0.05in; font-size: 8pt; font-weight: 800; font-variant-numeric: tabular-nums; letter-spacing: 0.04em; }
    .kidcheck-season { font-size: 7pt; font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em; color: #64748b; }
    .kidcheck-class { font-size: 11pt; font-weight: 800; line-height: 1.15; color: #0f172a; text-transform: uppercase; letter-spacing: 0.02em; }
    .kidcheck-line { font-size: 7.5pt; line-height: 1.25; color: #1e293b; }
    .kidcheck-line strong { font-weight: 700; }
    .kidcheck-footer { margin-top: auto; display: flex; flex-direction: column; align-items: center; gap: 0.02in; padding-top: 0.03in; }
    .timestamp { font-size: 6pt; color: #64748b; }
    .barcode { width: 100%; max-width: 1.6in; height: 0.22in; object-fit: fill; }
    .footer-qr { width: 0.55in; height: 0.55in; }
    .brand-strip { flex-shrink: 0; width: 0.28in; display: flex; align-items: center; justify-content: center; border-left: 1px solid #cbd5e1; padding-left: 0.03in; }
    .brand-logo { max-height: 100%; max-width: 0.24in; object-fit: contain; transform: rotate(-90deg); }
  `;

  const vbs = `
    .layout-vbs { display: flex; flex-direction: row; align-items: stretch; justify-content: space-between; gap: 0.08in; height: 100%; }
    .vbs-left { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: flex-start; text-align: left; gap: 0.028in; padding-top: 0.02in; }
    .vbs-child-name { font-weight: 400; line-height: 1.05; color: #0f172a; }
    .vbs-event { font-weight: 400; color: #334155; line-height: 1.1; margin-bottom: 0.02in; }
    .vbs-class { font-weight: 800; line-height: 1.1; color: #0f172a; margin-top: 0.01in; }
    .vbs-tshirt { font-weight: 800; line-height: 1.1; color: #0f172a; margin-top: 0.01in; }
    .vbs-guardian { font-weight: 800; line-height: 1.1; color: #0f172a; margin-top: 0.04in; }
    .vbs-phone { font-weight: 800; line-height: 1.1; color: #0f172a; }
    .vbs-right { flex-shrink: 0; display: flex; flex-direction: column; align-items: flex-end; justify-content: flex-end; gap: 0.03in; text-align: right; min-width: 0.85in; }
    .vbs-reg-number { font-weight: 800; font-variant-numeric: tabular-nums; letter-spacing: 0.03em; color: #0f172a; }
    .vbs-qr { display: block; }
    .vbs-timestamp { color: #64748b; line-height: 1.15; }
  `;

  return `${base}\n${vbs}\n${nameCode}\n${kidcheck}`;
}

export function buildBadgePrintHtml(payload: BadgePrintPayload): string {
  const dims = badgeLabelPageCss(payload.settings.labelSize, payload.settings.orientation);
  const horizontal = dims.isHorizontal;
  const layout = horizontal ? payload.settings.horizontalLayout : "STANDARD";

  let bodyContent: string;
  if (!horizontal || layout === "STANDARD") {
    bodyContent = horizontal ? renderStandardHorizontal(payload) : renderStandardVertical(payload);
  } else if (layout === "NAME_CODE_HEADER") {
    bodyContent = renderNameCodeHeader(payload);
  } else {
    bodyContent = renderKidCheck(payload);
  }

  const css = layoutCss(horizontal)
    .replace(/VAR_WIDTH/g, dims.width)
    .replace(/VAR_HEIGHT/g, dims.height);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Badge — ${escapeHtml(payload.childName)}</title>
  <style>
    @page { size: ${dims.pageSize}; margin: 0; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      width: ${dims.width};
      height: ${dims.height};
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #fff;
    }
    ${css}
  </style>
</head>
<body>
  ${bodyContent}
</body>
</html>`;
}

export function printBadgeDocument(html: string): void {
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.setAttribute("aria-hidden", "true");
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument;
  const win = iframe.contentWindow;
  if (!doc || !win) {
    document.body.removeChild(iframe);
    throw new Error("Could not open print frame.");
  }

  doc.open();
  doc.write(html);
  doc.close();

  const cleanup = () => {
    setTimeout(() => {
      if (iframe.parentNode) document.body.removeChild(iframe);
    }, 500);
  };

  win.onafterprint = cleanup;
  setTimeout(() => {
    win.focus();
    win.print();
  }, 250);
}
