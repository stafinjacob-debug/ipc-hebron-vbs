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
    default:
      return "line detail";
  }
}

export function buildBadgePrintHtml(payload: BadgePrintPayload): string {
  const dims = badgeLabelPageCss(payload.settings.labelSize);
  const linesHtml = payload.lines
    .map(
      (line) =>
        `<div class="${lineClass(line.kind)}">${escapeHtml(line.text)}</div>`,
    )
    .join("");

  const logoHtml = payload.settings.logoUrl
    ? `<img class="logo" src="${escapeHtml(payload.settings.logoUrl)}" alt="" />`
    : "";

  const qrHtml =
    payload.qrDataUrl && payload.settings.showQrCode
      ? `<div class="qr-wrap"><img class="qr" src="${payload.qrDataUrl}" alt="Check-in QR code" /></div>`
      : "";

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
    .badge {
      width: ${dims.width};
      height: ${dims.height};
      padding: 0.12in;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      gap: 0.06in;
      overflow: hidden;
    }
    .logo {
      max-width: 0.9in;
      max-height: 0.45in;
      object-fit: contain;
    }
    .line.season {
      font-size: 9pt;
      font-weight: 600;
      letter-spacing: 0.02em;
      text-transform: uppercase;
      color: #334155;
    }
    .line.name {
      font-size: 18pt;
      font-weight: 800;
      line-height: 1.05;
    }
    .line.number {
      font-size: 11pt;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      letter-spacing: 0.04em;
    }
    .line.detail {
      font-size: 11pt;
      font-weight: 600;
      color: #1e293b;
    }
    .line.allergy {
      font-size: 9pt;
      font-weight: 700;
      color: #b45309;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .qr-wrap { margin-top: 0.04in; }
    .qr {
      width: 0.95in;
      height: 0.95in;
      display: block;
    }
  </style>
</head>
<body>
  <div class="badge">
    ${logoHtml}
    ${linesHtml}
    ${qrHtml}
  </div>
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
