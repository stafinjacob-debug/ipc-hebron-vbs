/**
 * Prints how Node parses DATABASE_URL from web/.env.local (hostname + db name only).
 * Run: npm run db:check-url
 */
import { config } from "dotenv";
import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envLocal = path.join(root, ".env.local");

if (!existsSync(envLocal)) {
  console.error("Missing:", envLocal);
  process.exit(1);
}

config({ path: envLocal });

const raw = process.env.DATABASE_URL?.trim();
if (!raw) {
  console.error("DATABASE_URL is empty in .env.local");
  process.exit(1);
}

// postgresql: is not always accepted by URL(); use http: for parsing only
let parsed;
try {
  const asHttp = raw.replace(/^postgresql:/i, "http:");
  parsed = new URL(asHttp);
} catch (e) {
  console.error("DATABASE_URL is not a valid URL. Special characters in the password must be percent-encoded.");
  console.error(e.message);
  process.exit(1);
}

const host = parsed.hostname;
const db = (parsed.pathname || "").replace(/^\//, "") || "(none)";

console.log("From web/.env.local:");
console.log("  hostname:", host);
console.log("  port:    ", parsed.port || "(default 5432)");
console.log("  database:", db);

const badPlaceholder = ["base", "host", "your-database-hostname", "HOST", "DATABASE"].includes(
  host,
);
if (badPlaceholder || host.length < 4) {
  console.error(
    "\nThis hostname looks like a placeholder or mistake. It must be your real server, e.g.",
    "ipc-hebron-vbs-….postgres.database.azure.com or localhost",
  );
  process.exit(2);
}

console.log("\nIf login still fails, confirm Azure firewall allows your current public IP.");
