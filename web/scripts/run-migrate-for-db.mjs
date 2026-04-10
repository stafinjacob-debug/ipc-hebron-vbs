#!/usr/bin/env node
/**
 * Run `prisma migrate deploy` against the same host/user as DATABASE_URL in `.env.local`,
 * but with a different database name (e.g. vbs vs vbs_production).
 *
 * Usage (from repo root or web/):
 *   node scripts/run-migrate-for-db.mjs vbs_production
 */
import { spawnSync } from "node:child_process";
import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(__dirname, "..");

config({ path: resolve(webRoot, ".env.local") });

const dbName = process.argv[2];
if (!dbName) {
  console.error("Usage: node scripts/run-migrate-for-db.mjs <database_name>");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Add web/.env.local.");
  process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL.replace(
  /\/[^/?]+(\?|$)/,
  `/${dbName}$1`,
);

const result = spawnSync("npx", ["prisma", "migrate", "deploy"], {
  cwd: webRoot,
  env: { ...process.env, DATABASE_URL: databaseUrl },
  stdio: "inherit",
});

process.exit(result.status ?? 1);
