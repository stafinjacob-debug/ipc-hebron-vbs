import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

const root = process.cwd();
const standalone = join(root, ".next", "standalone");
const nextStatic = join(root, ".next", "static");
const targetStatic = join(standalone, ".next", "static");
const publicDir = join(root, "public");

if (!existsSync(standalone)) {
  console.error("Missing .next/standalone — run `next build` with output: standalone first.");
  process.exit(1);
}

mkdirSync(join(standalone, ".next"), { recursive: true });
if (existsSync(nextStatic)) {
  cpSync(nextStatic, targetStatic, { recursive: true });
}
if (existsSync(publicDir)) {
  cpSync(publicDir, join(standalone, "public"), { recursive: true });
}

const dejavuTtf = join(root, "node_modules", "dejavu-fonts-ttf", "ttf");
const standaloneFonts = join(standalone, "node_modules", "dejavu-fonts-ttf", "ttf");
const publicBadgeFonts = join(root, "public", "fonts", "badge-print");
const standalonePublicBadgeFonts = join(standalone, "public", "fonts", "badge-print");

if (existsSync(publicBadgeFonts)) {
  mkdirSync(standalonePublicBadgeFonts, { recursive: true });
  for (const name of ["DejaVuSans.ttf", "DejaVuSans-Bold.ttf"]) {
    const src = join(publicBadgeFonts, name);
    if (existsSync(src)) {
      cpSync(src, join(standalonePublicBadgeFonts, name));
    }
  }
}

if (existsSync(dejavuTtf)) {
  mkdirSync(standaloneFonts, { recursive: true });
  for (const name of ["DejaVuSans.ttf", "DejaVuSans-Bold.ttf"]) {
    const src = join(dejavuTtf, name);
    if (existsSync(src)) {
      cpSync(src, join(standaloneFonts, name));
    }
  }
}

const resvgRoot = join(root, "node_modules", "@resvg");
const standaloneResvgRoot = join(standalone, "node_modules", "@resvg");
if (existsSync(resvgRoot)) {
  mkdirSync(standaloneResvgRoot, { recursive: true });
  for (const entry of readdirSync(resvgRoot)) {
    if (!entry.startsWith("resvg-js")) continue;
    cpSync(join(resvgRoot, entry), join(standaloneResvgRoot, entry), { recursive: true });
  }
}

const sharpRoot = join(root, "node_modules", "sharp");
const standaloneSharpRoot = join(standalone, "node_modules", "sharp");
if (existsSync(sharpRoot)) {
  cpSync(sharpRoot, standaloneSharpRoot, { recursive: true });
}

const imgRoot = join(root, "node_modules", "@img");
const standaloneImgRoot = join(standalone, "node_modules", "@img");
if (existsSync(imgRoot)) {
  cpSync(imgRoot, standaloneImgRoot, { recursive: true });
}

/** Azure App Service may run Oryx against package.json; avoid npm start → next start (wrong for standalone). */
const pkgPath = join(standalone, "package.json");
if (existsSync(pkgPath)) {
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  pkg.scripts = { start: "node server.js" };
  delete pkg.postinstall;
  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
}

/** Tell Kudu/Oryx not to rebuild this zip (pre-built standalone + node_modules). */
writeFileSync(
  join(standalone, ".deployment"),
  "[config]\nSCM_DO_BUILD_DURING_DEPLOYMENT=false\n",
  "utf8",
);

console.log("Standalone bundle prepared for Azure (static + public copied).");
