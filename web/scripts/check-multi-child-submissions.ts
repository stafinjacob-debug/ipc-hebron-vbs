/**
 * Diagnose multi-child form submissions: count registrations per submission.
 * Usage: npx dotenv -e .env.local -- npx tsx scripts/check-multi-child-submissions.ts --database=vbs_production [--slug=retreat]
 */
import { config } from "dotenv";
import { existsSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
if (existsSync(resolve(webRoot, ".env.local"))) {
  config({ path: resolve(webRoot, ".env.local") });
}

function resolveUrl(database: string | null): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL required");
  if (!database) return url;
  return url.replace(/\/[^/?]+(\?|$)/, `/${database}$1`);
}

async function main() {
  const dbArg = process.argv.find((a) => a.startsWith("--database="));
  const database = dbArg?.slice("--database=".length).trim() || null;
  const slugArg = process.argv.find((a) => a.startsWith("--slug="));
  const slug = slugArg?.slice("--slug=".length).trim() || "retreat";

  const pool = new pg.Pool({ connectionString: resolveUrl(database) });
  try {
    const seasonRes = await pool.query<{ id: string; name: string }>(
      `SELECT id, name FROM "VbsSeason" WHERE "publicRegistrationSlug" = $1 OR name ILIKE '%Youth Retreat%' ORDER BY "updatedAt" DESC LIMIT 5`,
      [slug],
    );
    console.log("Seasons:", seasonRes.rows);

    for (const season of seasonRes.rows) {
      const stats = await pool.query<{
        total_subs: string;
        multi_subs: string;
        max_kids: string;
        total_regs: string;
      }>(
        `
        SELECT
          COUNT(*)::text AS total_subs,
          COUNT(*) FILTER (WHERE c.cnt > 1)::text AS multi_subs,
          COALESCE(MAX(c.cnt), 0)::text AS max_kids,
          (SELECT COUNT(*)::text FROM "Registration" r WHERE r."seasonId" = $1) AS total_regs
        FROM (
          SELECT fs.id, COUNT(r.id) AS cnt
          FROM "FormSubmission" fs
          LEFT JOIN "Registration" r ON r."formSubmissionId" = fs.id
          WHERE fs."seasonId" = $1
          GROUP BY fs.id
        ) c
        `,
        [season.id],
      );
      console.log(`\n${season.name} [${season.id}]`);
      console.log(stats.rows[0]);

      const samples = await pool.query(
        `
        SELECT
          fs."registrationCode",
          g.email,
          COUNT(r.id)::int AS kids,
          array_agg(c."firstName" || ' ' || c."lastName" ORDER BY r."registeredAt") AS names,
          array_agg(r.status ORDER BY r."registeredAt") AS statuses
        FROM "FormSubmission" fs
        JOIN "Guardian" g ON g.id = fs."guardianId"
        JOIN "Registration" r ON r."formSubmissionId" = fs.id
        JOIN "Child" c ON c.id = r."childId"
        WHERE fs."seasonId" = $1
        GROUP BY fs.id, fs."registrationCode", g.email
        HAVING COUNT(r.id) > 1
        ORDER BY kids DESC
        LIMIT 15
        `,
        [season.id],
      );
      console.log("Sample multi-child submissions:");
      for (const row of samples.rows) console.log(row);

      // Submissions where guardianResponses or something suggests multiple kids but only 1 registration
      const mismatch = await pool.query(
        `
        SELECT fs."registrationCode", g.email, g."firstName", g."lastName",
               (SELECT COUNT(*) FROM "Registration" r WHERE r."formSubmissionId" = fs.id) AS reg_count,
               fs."submittedAt"
        FROM "FormSubmission" fs
        JOIN "Guardian" g ON g.id = fs."guardianId"
        WHERE fs."seasonId" = $1
          AND (
            fs."guardianResponses"::text ILIKE '%child%'
            OR EXISTS (
              SELECT 1 FROM "Registration" r2
              JOIN "Child" c2 ON c2.id = r2."childId"
              WHERE r2."seasonId" = $1 AND c2."guardianId" = g.id
              GROUP BY c2."guardianId"
              HAVING COUNT(*) > 1
            )
          )
        ORDER BY fs."submittedAt" DESC
        LIMIT 5
        `,
        [season.id],
      );
      console.log("Recent related samples (guardian multi-child elsewhere):", mismatch.rowCount);
    }
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
