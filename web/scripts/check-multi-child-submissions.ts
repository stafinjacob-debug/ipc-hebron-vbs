/**
 * Diagnose multi-child form submissions and simulate CSV export row counts.
 * Usage: npx dotenv -e .env.local -- npx tsx scripts/check-multi-child-submissions.ts --database=vbs_production [--slug=retreat]
 */
import { config } from "dotenv";
import { existsSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import {
  DEFAULT_EXPORT_FIELD_KEYS,
  buildRegistrationExportFieldOptionsFromJson,
  resolveRegistrationExportFieldValue,
} from "../src/lib/registration-export";

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

function csvCell(s: string) {
  return `"${String(s).replace(/"/g, '""')}"`;
}

async function main() {
  const dbArg = process.argv.find((a) => a.startsWith("--database="));
  const database = dbArg?.slice("--database=".length).trim() || null;
  const slugArg = process.argv.find((a) => a.startsWith("--slug="));
  const slug = slugArg?.slice("--slug=".length).trim() || "retreat";

  const pool = new pg.Pool({ connectionString: resolveUrl(database) });
  try {
    const seasonRes = await pool.query<{
      id: string;
      name: string;
      year: number;
      published_definition_json: string | null;
      draft_definition_json: string | null;
    }>(
      `
      SELECT s.id, s.name, s.year,
             f."publishedDefinitionJson" AS published_definition_json,
             f."draftDefinitionJson" AS draft_definition_json
      FROM "VbsSeason" s
      LEFT JOIN "RegistrationForm" f ON f."seasonId" = s.id
      WHERE s."publicRegistrationSlug" = $1 OR s.name ILIKE '%Youth Retreat%'
      ORDER BY s."updatedAt" DESC
      LIMIT 5
      `,
      [slug],
    );
    console.log(
      "Seasons:",
      seasonRes.rows.map((r) => ({ id: r.id, name: r.name, year: r.year })),
    );

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
        LIMIT 8
        `,
        [season.id],
      );
      console.log("Sample multi-child submissions:");
      for (const row of samples.rows) console.log(row);

      const exportRows = await pool.query<{
        id: string;
        registration_number: string | null;
        status: string;
        registered_at: Date;
        notes: string | null;
        custom_responses: unknown;
        expects_payment: boolean;
        payment_received_at: Date | null;
        child_first: string;
        child_last: string;
        child_dob: Date;
        allergies: string | null;
        g_first: string;
        g_last: string;
        g_email: string | null;
        g_phone: string | null;
        classroom_name: string | null;
        submission_code: string | null;
        guardian_responses: unknown;
        stripe_payment_status: string | null;
        stripe_checkout_session_id: string | null;
      }>(
        `
        SELECT
          r.id,
          r."registrationNumber" AS registration_number,
          r.status,
          r."registeredAt" AS registered_at,
          r.notes,
          r."customResponses" AS custom_responses,
          r."expectsPayment" AS expects_payment,
          r."paymentReceivedAt" AS payment_received_at,
          c."firstName" AS child_first,
          c."lastName" AS child_last,
          c."dateOfBirth" AS child_dob,
          c."allergiesNotes" AS allergies,
          g."firstName" AS g_first,
          g."lastName" AS g_last,
          g.email AS g_email,
          g.phone AS g_phone,
          cl.name AS classroom_name,
          fs."registrationCode" AS submission_code,
          fs."guardianResponses" AS guardian_responses,
          fs."stripePaymentStatus" AS stripe_payment_status,
          fs."stripeCheckoutSessionId" AS stripe_checkout_session_id
        FROM "Registration" r
        JOIN "Child" c ON c.id = r."childId"
        JOIN "Guardian" g ON g.id = c."guardianId"
        LEFT JOIN "Classroom" cl ON cl.id = r."classroomId"
        LEFT JOIN "FormSubmission" fs ON fs.id = r."formSubmissionId"
        WHERE r."seasonId" = $1
        ORDER BY r."registeredAt" DESC
        `,
        [season.id],
      );

      const options = buildRegistrationExportFieldOptionsFromJson(
        season.published_definition_json ?? season.draft_definition_json,
      );
      const optionMap = new Map(options.map((o) => [o.key, o]));
      const columns = DEFAULT_EXPORT_FIELD_KEYS.filter((k) => optionMap.has(k));
      const lines: string[] = [
        columns.map((k) => csvCell(optionMap.get(k)?.label ?? k)).join(","),
      ];
      const childNames: string[] = [];

      for (const r of exportRows.rows) {
        const values = columns.map((k) =>
          resolveRegistrationExportFieldValue(
            {
              id: r.id,
              registrationNumber: r.registration_number,
              status: r.status,
              registeredAt: r.registered_at,
              notes: r.notes,
              customResponses: r.custom_responses,
              expectsPayment: r.expects_payment,
              paymentReceivedAt: r.payment_received_at,
              child: {
                firstName: r.child_first,
                lastName: r.child_last,
                dateOfBirth: r.child_dob,
                allergiesNotes: r.allergies,
                guardian: {
                  firstName: r.g_first,
                  lastName: r.g_last,
                  email: r.g_email,
                  phone: r.g_phone,
                },
              },
              classroom: r.classroom_name ? { name: r.classroom_name } : null,
              formSubmission: r.submission_code
                ? {
                    registrationCode: r.submission_code,
                    guardianResponses: r.guardian_responses,
                    stripePaymentStatus: r.stripe_payment_status,
                    stripeCheckoutSessionId: r.stripe_checkout_session_id,
                  }
                : null,
            },
            season.name,
            k,
          ),
        );
        lines.push(values.map(csvCell).join(","));
        childNames.push(`${r.child_first} ${r.child_last}`);
      }

      const uniqueNames = new Set(childNames.map((n) => n.toLowerCase()));
      console.log("Simulated /registrations/export:");
      console.log({
        dataRows: exportRows.rows.length,
        csvLinesIncludingHeader: lines.length,
        uniqueChildNames: uniqueNames.size,
        sampleMultiFamilyRows: childNames
          .filter((n) => /mathew|cherian|samkutty/i.test(n))
          .slice(0, 20),
      });

      const byCode = new Map<string, string[]>();
      for (const r of exportRows.rows) {
        const code = r.submission_code ?? "(none)";
        const list = byCode.get(code) ?? [];
        list.push(`${r.child_first} ${r.child_last}`);
        byCode.set(code, list);
      }
      const multiInExport = [...byCode.entries()].filter(([, names]) => names.length > 1);
      console.log(`Export groups with >1 child: ${multiInExport.length}`);
      console.log("First multi group:", multiInExport[0] ?? null);

      // Pending regs often share blank registration # — Excel "remove duplicates" on that column
      // would collapse siblings. Count how many blank registration numbers exist among multi-child.
      const blankRegNumMulti = exportRows.rows.filter((r) => {
        if (r.registration_number) return false;
        const peers = byCode.get(r.submission_code ?? "(none)") ?? [];
        return peers.length > 1;
      }).length;
      console.log({ blankRegistrationNumberAmongMultiChildRows: blankRegNumMulti });
    }
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
