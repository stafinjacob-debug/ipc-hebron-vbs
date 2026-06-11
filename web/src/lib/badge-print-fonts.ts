import { readFileSync } from "fs";
import path from "path";

const BADGE_FONT = "BadgePrint";

let svgFontDefs: string | null = null;

function loadFontBase64(fileName: string): string {
  // Use process.cwd() to avoid webpack trying to bundle .ttf files via require.resolve
  const fontPath = path.join(process.cwd(), "node_modules", "dejavu-fonts-ttf", "ttf", fileName);
  return readFileSync(fontPath).toString("base64");
}

/** SVG @font-face rules with embedded TTF (required for sharp/librsvg on Linux). */
export function badgePrintSvgFontDefs(): string {
  if (svgFontDefs) return svgFontDefs;

  const regular = loadFontBase64("DejaVuSans.ttf");
  const bold = loadFontBase64("DejaVuSans-Bold.ttf");

  svgFontDefs = `
@font-face {
  font-family: '${BADGE_FONT}';
  font-weight: 400;
  font-style: normal;
  src: url('data:font/truetype;base64,${regular}') format('truetype');
}
@font-face {
  font-family: '${BADGE_FONT}';
  font-weight: 700;
  font-style: normal;
  src: url('data:font/truetype;base64,${bold}') format('truetype');
}
@font-face {
  font-family: '${BADGE_FONT}';
  font-weight: 800;
  font-style: normal;
  src: url('data:font/truetype;base64,${bold}') format('truetype');
}
`;

  return svgFontDefs;
}

export const BADGE_PRINT_FONT_FAMILY = `${BADGE_FONT}, sans-serif`;
