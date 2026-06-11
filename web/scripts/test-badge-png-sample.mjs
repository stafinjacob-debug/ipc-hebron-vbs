/**
 * Render a sample KidCheck badge PNG locally (same resvg + font path as production).
 * Usage: node scripts/test-badge-png-sample.mjs
 */
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "fs";
import { execSync } from "child_process";
import { tmpdir } from "os";
import { join } from "path";
import QRCode from "qrcode";
import { Resvg } from "@resvg/resvg-js";

const root = process.cwd();
const outPath = join(root, "badge-sample-test.png");

const FONT_NAMES = ["DejaVuSans.ttf", "DejaVuSans-Bold.ttf"];

function badgePrintFontDir() {
  const candidates = [
    join(root, "public", "fonts", "badge-print"),
    join(root, "node_modules", "dejavu-fonts-ttf", "ttf"),
  ];
  const targetDir = join(tmpdir(), "vbs-badge-print-fonts");
  mkdirSync(targetDir, { recursive: true });
  for (const name of FONT_NAMES) {
    const dest = join(targetDir, name);
    if (existsSync(dest)) continue;
    for (const dir of candidates) {
      const src = join(dir, name);
      if (existsSync(src)) {
        copyFileSync(src, dest);
        break;
      }
    }
    if (!existsSync(dest)) {
      throw new Error(`Missing font ${name}`);
    }
  }
  return targetDir;
}

const w = 609;
const h = 406;
const qrDataUrl = await QRCode.toDataURL("https://vbs.ipchouston.com/ticket/test", {
  width: 240,
  margin: 1,
  color: { dark: "#0f172a", light: "#ffffff" },
});

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="100%" height="100%" fill="#ffffff"/>
  <text x="16" y="42" font-family="DejaVu Sans" font-size="22" font-weight="800" fill="#0f172a">Emma Johnson</text>
  <rect x="${w - 110}" y="16" width="94" height="34" fill="#0f172a" rx="2"/>
  <text x="${w - 63}" y="38" text-anchor="middle" font-family="DejaVu Sans" font-size="11" font-weight="800" fill="#ffffff">A7K2</text>
  <line x1="16" y1="58" x2="${w - 16}" y2="58" stroke="#0f172a" stroke-width="2" />
  <text x="16" y="88" font-family="DejaVu Sans" font-size="11" font-weight="600" fill="#1e293b">VBS 2026 — Shipwrecked</text>
  <text x="16" y="110" font-family="DejaVu Sans" font-size="11" font-weight="600" fill="#1e293b">3rd Grade — Room 204</text>
  <text x="16" y="132" font-family="DejaVu Sans" font-size="11" font-weight="600" fill="#1e293b">Guardian: Sarah Johnson</text>
  <text x="16" y="154" font-family="Deja Vu Sans" font-size="11" font-weight="600" fill="#1e293b">Medical / allergy info: Peanut allergy</text>
  <text x="${w / 2}" y="${h - 82}" text-anchor="middle" font-family="DejaVu Sans" font-size="9" fill="#64748b">Jun 9, 2026 9:15 AM</text>
  <image href="${qrDataUrl}" x="${w / 2 - 28}" y="${h - 72}" width="56" height="56" />
</svg>`;

const fontDir = badgePrintFontDir();
const fontFiles = FONT_NAMES.map((name) => join(fontDir, name));
console.log("Fonts from:", fontDir);

const resvg = new Resvg(svg, {
  font: {
    fontDirs: [fontDir],
    fontFiles,
    loadSystemFonts: false,
    defaultFontFamily: "DejaVu Sans",
    sansSerifFamily: "DejaVu Sans",
  },
});

const png = resvg.render().asPng();
writeFileSync(outPath, png);
console.log(`Wrote ${outPath} (${png.length} bytes)`);

if (process.platform === "darwin") {
  execSync(`open "${outPath}"`);
  console.log("Opened in Preview — verify text, then print to Brother if paired in System Settings.");
}
