import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { defineConfig } from "prisma/config";

// Default dotenv only reads `.env`. Next.js uses `.env.local` for secrets — load both
// so `npx prisma migrate deploy` works without dotenv-cli.
const root = process.cwd();
// Preserve URL injected before this file runs (e.g. `dotenv-cli -e .env.azure.local -- prisma …`)
// so alternate env files are not overwritten by `.env.local`.
const databaseUrlFromEnv = process.env.DATABASE_URL;
loadEnv({ path: resolve(root, ".env") });
loadEnv({ path: resolve(root, ".env.local"), override: true });
if (databaseUrlFromEnv) {
  process.env.DATABASE_URL = databaseUrlFromEnv;
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL is not set. Add it to web/.env or web/.env.local, or run: npm run db:migrate (uses .env.local).",
  );
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: databaseUrl,
  },
});
