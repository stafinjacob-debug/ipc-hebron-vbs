import path from "path";

export const BADGE_PRINT_FONT_FAMILY = "DejaVu Sans";

export function badgePrintFontFiles(): string[] {
  const ttfDir = path.join(process.cwd(), "node_modules", "dejavu-fonts-ttf", "ttf");
  return [
    path.join(ttfDir, "DejaVuSans.ttf"),
    path.join(ttfDir, "DejaVuSans-Bold.ttf"),
  ];
}
