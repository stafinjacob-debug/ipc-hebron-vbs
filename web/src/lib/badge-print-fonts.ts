import { copyFileSync, existsSync, mkdirSync } from "fs";
import path from "path";
import { tmpdir } from "os";

export const BADGE_PRINT_FONT_FAMILY = "DejaVu Sans";

const FONT_NAMES = ["DejaVuSans.ttf", "DejaVuSans-Bold.ttf"] as const;

function candidateFontDirs(): string[] {
  const cwd = process.cwd();
  return [
    path.join(cwd, "public", "fonts", "badge-print"),
    path.join(cwd, "node_modules", "dejavu-fonts-ttf", "ttf"),
  ];
}

let cachedFontDir: string | null = null;

/** Resolve a writable directory containing DejaVu TTFs (cached under os tmpdir). */
export function badgePrintFontDir(): string {
  if (cachedFontDir) return cachedFontDir;

  const targetDir = path.join(tmpdir(), "vbs-badge-print-fonts");
  mkdirSync(targetDir, { recursive: true });

  for (const name of FONT_NAMES) {
    const dest = path.join(targetDir, name);
    if (existsSync(dest)) continue;

    let copied = false;
    for (const dir of candidateFontDirs()) {
      const src = path.join(dir, name);
      if (existsSync(src)) {
        copyFileSync(src, dest);
        copied = true;
        break;
      }
    }

    if (!copied) {
      throw new Error(
        `Badge print font "${name}" not found. Checked: ${candidateFontDirs().join(", ")}`,
      );
    }
  }

  cachedFontDir = targetDir;
  return targetDir;
}

export function badgePrintFontFiles(): string[] {
  const dir = badgePrintFontDir();
  return FONT_NAMES.map((name) => path.join(dir, name));
}

export function badgePrintFontStatus(): {
  ok: boolean;
  fontDir: string;
  fontFiles: string[];
} {
  try {
    const fontDir = badgePrintFontDir();
    const fontFiles = badgePrintFontFiles();
    return {
      ok: fontFiles.every((file) => existsSync(file)),
      fontDir,
      fontFiles,
    };
  } catch {
    return {
      ok: false,
      fontDir: cachedFontDir ?? "",
      fontFiles: [],
    };
  }
}
