/**
 * Configure birth-date auto-assignment and round-robin groups for VBS grade sections.
 *
 * Usage (from web/):
 *   npx dotenv -e .env.local -- tsx scripts/configure-vbs-class-auto-assign.ts
 *   npx dotenv -e .env.local -- tsx scripts/configure-vbs-class-auto-assign.ts --season-id=<id>
 *   npx dotenv -e .env.local -- tsx scripts/configure-vbs-class-auto-assign.ts --database=vbs_production
 *   npx dotenv -e .env.local -- tsx scripts/configure-vbs-class-auto-assign.ts --dry-run
 */
import { config } from "dotenv";
import { existsSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { parseLocalDate } from "../src/lib/schemas/vbs-registration";

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
if (existsSync(resolve(webRoot, ".env.local"))) {
  config({ path: resolve(webRoot, ".env.local") });
}

type GradeRule = {
  birthDateMin: string;
  birthDateMax: string;
  /** Shared key for A/B rotation; null for a single-section grade. */
  roundRobinGroupKey: string | null;
  sortOrder: number;
  sections: string[];
  /** Optional alternate names per section (same index as sections). */
  aliases?: string[];
};

/** IPC Hebron VBS grade sections — DOB windows and A/B round-robin pairs. */
const GRADE_RULES: GradeRule[] = [
  {
    birthDateMin: "2020-09-02",
    birthDateMax: "2021-09-01",
    roundRobinGroupKey: "pre-k-4",
    sortOrder: 0,
    sections: ["Pre-K 4A", "Pre-K 4B"],
  },
  {
    birthDateMin: "2019-09-02",
    birthDateMax: "2020-09-01",
    roundRobinGroupKey: "kinder",
    sortOrder: 10,
    sections: ["Kinder A", "Kinder B"],
  },
  {
    birthDateMin: "2018-09-02",
    birthDateMax: "2019-09-01",
    roundRobinGroupKey: "1st-grade",
    sortOrder: 20,
    sections: ["1st Grade A", "1st Grade B"],
    aliases: ["Grade 1A", "Grade 1B"],
  },
  {
    birthDateMin: "2017-09-02",
    birthDateMax: "2018-09-01",
    roundRobinGroupKey: "2nd-grade",
    sortOrder: 30,
    sections: ["2nd Grade A", "2nd Grade B"],
  },
  {
    birthDateMin: "2016-09-02",
    birthDateMax: "2017-09-01",
    roundRobinGroupKey: "3rd-grade",
    sortOrder: 40,
    sections: ["3rd Grade A", "3rd Grade B"],
  },
  {
    birthDateMin: "2015-09-02",
    birthDateMax: "2016-09-01",
    roundRobinGroupKey: "4th-grade",
    sortOrder: 50,
    sections: ["4th Grade A", "4th Grade B"],
  },
  {
    birthDateMin: "2014-09-02",
    birthDateMax: "2015-09-01",
    roundRobinGroupKey: "5th-grade",
    sortOrder: 60,
    sections: ["5th Grade A", "5th Grade B"],
  },
  {
    birthDateMin: "2013-09-02",
    birthDateMax: "2014-09-01",
    roundRobinGroupKey: null,
    sortOrder: 70,
    sections: ["6th Grade"],
  },
  {
    birthDateMin: "2012-09-02",
    birthDateMax: "2013-09-01",
    roundRobinGroupKey: null,
    sortOrder: 80,
    sections: ["7th Grade"],
  },
  {
    birthDateMin: "2011-09-02",
    birthDateMax: "2012-09-01",
    roundRobinGroupKey: "8th-grade",
    sortOrder: 90,
    sections: ["8th Grade A", "8th Grade B"],
  },
];

function parseArgs() {
  const dryRun = process.argv.includes("--dry-run");
  const seasonArg = process.argv.find((a) => a.startsWith("--season-id="));
  const seasonId = seasonArg?.slice("--season-id=".length).trim() || null;
  const dbArg = process.argv.find((a) => a.startsWith("--database="));
  const database = dbArg?.slice("--database=".length).trim() || null;
  return { dryRun, seasonId, database };
}

function normalizeClassName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function resolveDatabaseUrl(database: string | null): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required (set in web/.env.local).");
  if (!database) return url;
  return url.replace(/\/[^/?]+(\?|$)/, `/${database}$1`);
}

function findClassByNames(
  byNormalizedName: Map<string, { id: string; name: string }>,
  names: string[],
): { id: string; name: string } | undefined {
  for (const candidate of names) {
    const hit = byNormalizedName.get(normalizeClassName(candidate));
    if (hit) return hit;
  }
  return undefined;
}

async function main() {
  const { dryRun, seasonId: seasonIdArg, database } = parseArgs();
  const url = resolveDatabaseUrl(database);
  if (database) {
    console.log(`Database: ${database}`);
  }

  const pool = new Pool({ connectionString: url });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const season =
      (seasonIdArg
        ? await prisma.vbsSeason.findUnique({ where: { id: seasonIdArg } })
        : null) ??
      (await prisma.vbsSeason.findFirst({
        where: { isActive: true, programKind: "VBS" },
        orderBy: [{ year: "desc" }, { startDate: "desc" }],
      })) ??
      (await prisma.vbsSeason.findFirst({
        where: { isActive: true },
        orderBy: [{ year: "desc" }, { startDate: "desc" }],
      }));

    if (!season) {
      throw new Error("No VBS season found. Pass --season-id=<id>.");
    }

    console.log(`Season: ${season.name} (${season.year}) [${season.id}]`);
    if (dryRun) console.log("DRY RUN — no database writes.\n");

    const existing = await prisma.classroom.findMany({
      where: { seasonId: season.id },
      select: { id: true, name: true },
    });
    const byNormalizedName = new Map(
      existing.map((c) => [normalizeClassName(c.name), c]),
    );
    const matchedIds = new Set<string>();

    const updates: string[] = [];
    const creates: string[] = [];

    for (const rule of GRADE_RULES) {
      const birthDateMin = parseLocalDate(rule.birthDateMin);
      const birthDateMax = parseLocalDate(rule.birthDateMax);

      for (let i = 0; i < rule.sections.length; i++) {
        const canonicalName = rule.sections[i]!;
        const aliasName = rule.aliases?.[i];
        const lookupNames = [canonicalName, aliasName].filter(Boolean) as string[];
        const match = findClassByNames(byNormalizedName, lookupNames);

        const data = {
          birthDateMin,
          birthDateMax,
          roundRobinGroupKey: rule.roundRobinGroupKey,
          sortOrder: rule.sortOrder,
          useAgeRuleForAutoAssign: false,
          intakeStatus: "OPEN" as const,
          isActive: true,
        };

        if (match) {
          if (!dryRun) {
            await prisma.classroom.update({
              where: { id: match.id },
              data,
            });
          }
          matchedIds.add(match.id);
          const rrLabel = rule.roundRobinGroupKey
            ? `round-robin "${rule.roundRobinGroupKey}"`
            : "no round-robin";
          updates.push(
            `${match.name}: ${rule.birthDateMin}–${rule.birthDateMax}, ${rrLabel}`,
          );
        } else {
          if (!dryRun) {
            await prisma.classroom.create({
              data: {
                seasonId: season.id,
                name: canonicalName,
                capacity: 24,
                waitlistEnabled: true,
                ageMin: 0,
                ageMax: 99,
                ageRule: "EVENT_START_DATE",
                ...data,
              },
            });
          }
          creates.push(
            `${canonicalName}: ${rule.birthDateMin}–${rule.birthDateMax}, ${
              rule.roundRobinGroupKey
                ? `round-robin "${rule.roundRobinGroupKey}"`
                : "no round-robin"
            }`,
          );
        }
      }
    }

    console.log("\nUpdated:");
    for (const line of updates) console.log(`  • ${line}`);
    if (updates.length === 0) console.log("  (none)");

    console.log("\nCreated:");
    for (const line of creates) console.log(`  • ${line}`);
    if (creates.length === 0) console.log("  (none)");

    const untouched = existing.filter((c) => !matchedIds.has(c.id));
    if (untouched.length) {
      console.log("\nOther classes in season (unchanged):");
      for (const c of untouched) console.log(`  • ${c.name}`);
    }

    console.log(dryRun ? "\nDry run complete." : "\nDone.");
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
