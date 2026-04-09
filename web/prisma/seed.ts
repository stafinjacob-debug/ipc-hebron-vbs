/**
 * Loads `web/.env.local` from disk (next to `package.json`), then seeds the database.
 * Run: `npm run db:seed` from the `web/` directory.
 */
import { hash } from "bcryptjs";
import { config } from "dotenv";
import { existsSync, readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PrismaClient, UserRole } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** Directory that contains `package.json` and `.env.local` */
const webRoot = path.resolve(__dirname, "..");
const envLocalPath = path.join(webRoot, ".env.local");

/**
 * Read a single key from an env file without relying on `process.env` injection.
 * Some local tools only inject a subset of variables into Node; this still finds
 * values that exist in `web/.env.local`.
 */
function readEnvFileValue(filePath: string, key: string): string | undefined {
  if (!existsSync(filePath)) return undefined;
  const text = readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const lineRe = new RegExp(
    `^\\s*(?:export\\s+)?${escaped}\\s*=\\s*(.*?)\\s*$`,
  );
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const m = trimmed.match(lineRe);
    if (!m) continue;
    let v = m[1] ?? "";
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    } else {
      const cut = v.search(/\s+#/);
      if (cut !== -1) v = v.slice(0, cut).trim();
    }
    return v;
  }
  return undefined;
}

// `.env.local` wins over `.env` (same as Next.js)
config({ path: path.join(webRoot, ".env") });
if (existsSync(envLocalPath)) {
  config({ path: envLocalPath, override: true });
}

const url =
  process.env.DATABASE_URL ?? readEnvFileValue(envLocalPath, "DATABASE_URL");
if (!url) {
  throw new Error(
    `DATABASE_URL is missing. Add it to ${envLocalPath} (see .env.example). File exists: ${existsSync(envLocalPath)}.`,
  );
}

const pool = new Pool({ connectionString: url });
const prisma = new PrismaClient({
  adapter: new PrismaPg(pool),
  log: ["warn", "error"],
});

async function main() {
  const email =
    process.env.SEED_ADMIN_EMAIL?.trim() ||
    readEnvFileValue(envLocalPath, "SEED_ADMIN_EMAIL") ||
    "admin@example.local";

  const raw =
    process.env.SEED_ADMIN_PASSWORD ||
    readEnvFileValue(envLocalPath, "SEED_ADMIN_PASSWORD");
  const plain = typeof raw === "string" ? raw.trim() : "";

  if (plain.length < 8) {
    const inFile = readEnvFileValue(envLocalPath, "SEED_ADMIN_PASSWORD");
    const hint =
      raw === undefined && inFile === undefined
        ? "SEED_ADMIN_PASSWORD is missing from process.env and from a parseable line in .env.local (exact name: SEED_ADMIN_PASSWORD=value)."
        : raw === undefined && inFile !== undefined
          ? "SEED_ADMIN_PASSWORD was read from file but became empty after trim (check quotes/special characters)."
          : raw !== undefined && plain.length === 0
            ? "SEED_ADMIN_PASSWORD is empty."
            : `After trim, password length is ${plain.length} (need ≥8).`;
    throw new Error(
      `${hint}\n` +
        `Expected file: ${envLocalPath}\n` +
        `File exists: ${existsSync(envLocalPath)}\n` +
        `Use one line: SEED_ADMIN_PASSWORD=YourPasswordHere`,
    );
  }

  const passwordHash = await hash(plain, 12);

  const admin = await prisma.user.upsert({
    where: { email: email.toLowerCase() },
    create: {
      email: email.toLowerCase(),
      name: "VBS Admin",
      passwordHash,
      role: UserRole.SUPER_ADMIN,
      status: "ACTIVE",
    },
    update: {
      passwordHash,
      role: UserRole.SUPER_ADMIN,
      status: "ACTIVE",
    },
  });

  const start = new Date();
  start.setMonth(6, 1);
  const end = new Date(start);
  end.setDate(end.getDate() + 4);

  const season = await prisma.vbsSeason.upsert({
    where: { id: "seed-season-demo" },
    create: {
      id: "seed-season-demo",
      name: "Summer VBS",
      year: start.getFullYear(),
      theme: "Seed data — update in app",
      startDate: start,
      endDate: end,
      isActive: true,
    },
    update: {},
  });

  const room = await prisma.classroom.upsert({
    where: { id: "seed-classroom-demo" },
    create: {
      id: "seed-classroom-demo",
      seasonId: season.id,
      name: "Elementary Crew",
      ageMin: 5,
      ageMax: 10,
      capacity: 24,
    },
    update: {},
  });

  const guardian = await prisma.guardian.upsert({
    where: { id: "seed-guardian-demo" },
    create: {
      id: "seed-guardian-demo",
      firstName: "Sample",
      lastName: "Guardian",
      email: "guardian@example.local",
      phone: "555-0100",
    },
    update: {},
  });

  const child = await prisma.child.upsert({
    where: { id: "seed-child-demo" },
    create: {
      id: "seed-child-demo",
      guardianId: guardian.id,
      firstName: "Jordan",
      lastName: "Sample",
      dateOfBirth: new Date("2016-03-15"),
      allergiesNotes: null,
    },
    update: {},
  });

  await prisma.registration.upsert({
    where: {
      childId_seasonId: { childId: child.id, seasonId: season.id },
    },
    create: {
      childId: child.id,
      seasonId: season.id,
      classroomId: room.id,
      status: "CONFIRMED",
      registrationNumber: `VBS-${season.year}-SEED01`,
      checkInToken: "seed-demo-check-in-token-replace-in-prod",
    },
    update: {
      classroomId: room.id,
      status: "CONFIRMED",
    },
  });

  const volUser = await prisma.user.upsert({
    where: { email: "volunteer@example.local" },
    create: {
      email: "volunteer@example.local",
      name: "Sample Volunteer",
      passwordHash: await hash(plain, 12),
      role: UserRole.CHECK_IN_VOLUNTEER,
      status: "ACTIVE",
    },
    update: {
      passwordHash: await hash(plain, 12),
      role: UserRole.CHECK_IN_VOLUNTEER,
      status: "ACTIVE",
    },
  });

  await prisma.volunteerProfile.upsert({
    where: { userId: volUser.id },
    create: {
      userId: volUser.id,
      displayName: volUser.name ?? "Volunteer",
      backgroundCheckOk: true,
    },
    update: { backgroundCheckOk: true },
  });

  const profile = await prisma.volunteerProfile.findUniqueOrThrow({
    where: { userId: volUser.id },
  });

  await prisma.volunteerAssignment.upsert({
    where: { id: "seed-assignment-demo" },
    create: {
      id: "seed-assignment-demo",
      profileId: profile.id,
      seasonId: season.id,
      classroomId: room.id,
      roleTitle: "Station helper",
    },
    update: {},
  });

  console.log("Seed complete. Admin:", admin.email, "| Season:", season.name);
}

main()
  .then(async () => {
    await prisma.$disconnect();
    await pool.end();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    await pool.end();
    process.exit(1);
  });
