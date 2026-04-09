import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
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
