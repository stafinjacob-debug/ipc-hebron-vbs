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
    case "custom":
      return "line custom";
    default:
      return "line detail";
  }
}

function renderLine(line: BadgePrintPayload["lines"][number]): string {
  const text = escapeHtml(line.text);
  if (line.kind === "custom" && line.label) {
    return `<div class="${lineClass(line.kind)}"><span class="custom-label">${escapeHtml(line.label)}</span><span class="custom-text">${text}</span></div>`;
  }
  return `<div class="${lineClass(line.kind)}">${text}</div>`;
}

export function buildBadgePrintHtml(payload: BadgePrintPayload): string {
  const dims = badgeLabelPageCss(payload.settings.labelSize, payload.settings.orientation);
  const horizontal = dims.isHorizontal;
  const linesHtml = payload.lines.map(renderLine).join("");

  const logoHtml = payload.settings.logoUrl
    ? `<img class="logo" src="${escapeHtml(payload.settings.logoUrl)}" alt="" />`
    : "";

  const qrHtml =
    payload.qrDataUrl && payload.settings.showQrCode
      ? `<div class="qr-wrap"><img class="qr" src="${payload.qrDataUrl}" alt="Check-in QR code" /></div>`
      : "";

  const badgeClass = horizontal ? "badge horizontal" : "badge vertical";
  const bodyContent = horizontal
    ? `<div class="${badgeClass}">
        <div class="badge-main">${logoHtml}<div class="lines">${linesHtml}</div></div>
        ${qrHtml ? `<div class="badge-side">${qrHtml}</div>` : ""}
      </div>`
    : `<div class="${badgeClass}">${logoHtml}${linesHtml}${qrHtml}</div>`;

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
      padding: 0.1in;
      overflow: hidden;
    }
    .badge.vertical {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      gap: 0.05in;
    }
    .badge.horizontal {
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
      gap: 0.08in;
    }
    .badge-main {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      justify-content: center;
      text-align: left;
      gap: 0.03in;
    }
    .badge-main .lines {
      display: flex;
      flex-direction: column;
      gap: 0.02in;
      width: 100%;
    }
    .badge-side {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .logo {
      max-width: ${horizontal ? "0.75in" : "0.9in"};
      max-height: ${horizontal ? "0.35in" : "0.45in"};
      object-fit: contain;
    }
    .badge.horizontal .logo {
      align-self: flex-start;
    }
    .line.season {
      font-size: ${horizontal ? "7pt" : "9pt"};
      font-weight: 600;
      letter-spacing: 0.02em;
      text-transform: uppercase;
      color: #334155;
    }
    .line.name {
      font-size: ${horizontal ? "13pt" : "18pt"};
      font-weight: 800;
      line-height: 1.05;
    }
    .line.number {
      font-size: ${horizontal ? "9pt" : "11pt"};
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      letter-spacing: 0.04em;
    }
    .line.detail {
      font-size: ${horizontal ? "9pt" : "11pt"};
      font-weight: 600;
      color: #1e293b;
    }
    .line.allergy {
      font-size: ${horizontal ? "7pt" : "9pt"};
      font-weight: 700;
      color: #b45309;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .line.custom {
      display: flex;
      flex-direction: column;
      gap: 0.01in;
    }
    .custom-label {
      font-size: ${horizontal ? "6.5pt" : "8pt"};
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      color: #64748b;
    }
    .custom-text {
      font-size: ${horizontal ? "8.5pt" : "10pt"};
      font-weight: 600;
      color: #1e293b;
    }
    .qr-wrap { margin-top: ${horizontal ? "0" : "0.04in"}; }
    .qr {
      width: ${horizontal ? "0.78in" : "0.95in"};
      height: ${horizontal ? "0.78in" : "0.95in"};
      display: block;
    }
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
