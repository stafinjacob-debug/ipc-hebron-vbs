import { cpSync, existsSync, mkdirSync } from "fs";
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

console.log("Standalone bundle prepared for Azure (static + public copied).");
