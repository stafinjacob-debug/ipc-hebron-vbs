/**
 * Create and configure the Basketball Summer Camp (Boys & Girls) registration portal.
 *
 * Usage (from web/):
 *   npx dotenv -e .env.local -- tsx scripts/setup-basketball-summer-camp.ts --database=vbs_production
 *   npx dotenv -e .env.local -- tsx scripts/setup-basketball-summer-camp.ts --database=vbs_production --dry-run
 *   npx dotenv -e .env.local -- tsx scripts/setup-basketball-summer-camp.ts --database=vbs_production --open
 *
 * `--open` sets publicRegistrationOpen and isActive after setup (default: leaves registration closed).
 */
import { config } from "dotenv";
import { existsSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import {
  definitionToJson,
  type FormDefinitionV1,
} from "../src/lib/registration-form-definition";
import { parseLocalDate } from "../src/lib/schemas/vbs-registration";

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
if (existsSync(resolve(webRoot, ".env.local"))) {
  config({ path: resolve(webRoot, ".env.local") });
}

const SEASON_NAME = "Basketball Summer Camp for Boys & Girls";
const SEASON_YEAR = 2026;
const SLUG = "basketball";
const LEGACY_SLUG = "basketball-summer-camp-2026";
const START_DATE = "2026-07-28";
const END_DATE = "2026-07-30";
const CLASS_CAPACITY = 15;
const FEE_CENTS = 1500;

const GRADE_OPTIONS = [
  { value: "5th", label: "5th grade" },
  { value: "6th", label: "6th grade" },
  { value: "7th", label: "7th grade" },
  { value: "8th", label: "8th grade" },
  { value: "9th", label: "9th grade" },
  { value: "10th", label: "10th grade" },
  { value: "11th", label: "11th grade" },
  { value: "12th", label: "12th grade" },
] as const;

function parseArgs() {
  const dryRun = process.argv.includes("--dry-run");
  const openRegistration = process.argv.includes("--open");
  const dbArg = process.argv.find((a) => a.startsWith("--database="));
  const database = dbArg?.slice("--database=".length).trim() || null;
  return { dryRun, openRegistration, database };
}

function resolveDatabaseUrl(database: string | null): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required (set in web/.env.local).");
  if (!database) return url;
  return url.replace(/\/[^/?]+(\?|$)/, `/${database}$1`);
}

function buildFormDefinition(): FormDefinitionV1 {
  return {
    version: 1,
    sections: [
      {
        id: "sec_guardian",
        title: "Contact person",
        description: "We'll use this for camp updates and emergencies.",
        audience: "guardian",
        order: 0,
      },
      {
        id: "sec_child",
        title: "Player information",
        description: "Add each player registering for this camp.",
        audience: "eachChild",
        order: 1,
      },
      {
        id: "sec_consent",
        title: "Consent",
        description: "",
        audience: "consent",
        order: 2,
      },
    ],
    fields: [
      {
        id: "f_g_fn",
        sectionId: "sec_guardian",
        key: "guardianFirstName",
        type: "text",
        label: "First name",
        required: true,
        order: 0,
      },
      {
        id: "f_g_ln",
        sectionId: "sec_guardian",
        key: "guardianLastName",
        type: "text",
        label: "Last name",
        required: true,
        order: 1,
      },
      {
        id: "f_g_em",
        sectionId: "sec_guardian",
        key: "guardianEmail",
        type: "email",
        label: "Email",
        required: true,
        order: 2,
        placeholder: "name@example.com",
      },
      {
        id: "f_g_ph",
        sectionId: "sec_guardian",
        key: "guardianPhone",
        type: "tel",
        label: "Phone",
        required: true,
        order: 3,
        placeholder: "(555) 123-4567",
      },
      {
        id: "f_c_fn",
        sectionId: "sec_child",
        key: "childFirstName",
        type: "text",
        label: "Player first name",
        required: true,
        order: 0,
      },
      {
        id: "f_c_ln",
        sectionId: "sec_child",
        key: "childLastName",
        type: "text",
        label: "Player last name",
        required: true,
        order: 1,
      },
      {
        id: "f_c_grade",
        sectionId: "sec_child",
        key: "gradeFall2026",
        type: "select",
        label: "What grade will you be in in the fall of 2026?",
        required: true,
        order: 2,
        options: [...GRADE_OPTIONS],
      },
      {
        id: "f_c_gender",
        sectionId: "sec_child",
        key: "playerGender",
        type: "select",
        label: "Boys or girls division",
        required: true,
        order: 3,
        helperText: "Players are grouped into a boys or girls division for this camp.",
        options: [
          { value: "Boy", label: "Boy" },
          { value: "Girl", label: "Girl" },
        ],
      },
      {
        id: "f_c_alg",
        sectionId: "sec_child",
        key: "allergiesNotes",
        type: "textarea",
        label: "Allergies or medical notes",
        required: false,
        order: 4,
        placeholder: "None, or describe allergies / medications",
      },
    ],
  };
}

async function main() {
  const { dryRun, openRegistration, database } = parseArgs();
  const url = resolveDatabaseUrl(database);
  if (database) console.log(`Database: ${database}`);
  if (dryRun) console.log("DRY RUN — no database writes.\n");

  const pool = new Pool({ connectionString: url, connectionTimeoutMillis: 120_000 });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const existing = await prisma.vbsSeason.findFirst({
      where: {
        OR: [
          { publicRegistrationSlug: SLUG },
          { publicRegistrationSlug: LEGACY_SLUG },
          { name: SEASON_NAME },
        ],
      },
      select: { id: true, name: true, publicRegistrationSlug: true },
    });
    if (existing) {
      if (existing.publicRegistrationSlug !== SLUG) {
        if (!dryRun) {
          await prisma.vbsSeason.update({
            where: { id: existing.id },
            data: { publicRegistrationSlug: SLUG },
          });
        }
        console.log(`Updated slug: ${existing.publicRegistrationSlug ?? "(none)"} → ${SLUG}`);
      }
      const helpContactName = "Boby Jacob";
      const helpContactEmail = process.env.VBS_HELP_EMAIL?.trim() || "bobojacob@gmail.com";
      if (!dryRun) {
        await prisma.publicRegistrationSettings.upsert({
          where: { seasonId: existing.id },
          create: {
            seasonId: existing.id,
            helpContactName,
            helpContactEmail,
          },
          update: {
            helpContactName,
            helpContactEmail,
          },
        });
      }
      console.log(`Season already exists: ${existing.name} [${existing.id}]`);
      console.log(`Public URL: /basketball`);
      console.log(`Contact: ${helpContactName} · ${helpContactEmail}`);
      return;
    }

    const startDate = parseLocalDate(START_DATE);
    const endDate = parseLocalDate(END_DATE);
    const formDef = buildFormDefinition();
    const formJson = definitionToJson(formDef);

    const welcomeMessage =
      "Basketball Summer Camp for Boys & Girls\n" +
      "July 28–30, 2026 · 3:30 PM – 6:30 PM\n" +
      "Grades 5–12 · $15 per participant · 30 spots total";
    const helpContactName = "Boby Jacob";

    if (dryRun) {
      console.log("Would create:");
      console.log(`  Season: ${SEASON_NAME} (${SEASON_YEAR})`);
      console.log(`  Slug: ${SLUG} (public URL /basketball)`);
      console.log(`  Dates: ${START_DATE} – ${END_DATE}`);
      console.log(`  Classes: Boys (${CLASS_CAPACITY}), Girls (${CLASS_CAPACITY})`);
      console.log(`  Fee: $${FEE_CENTS / 100} per player`);
      console.log(`  Open registration: ${openRegistration}`);
      return;
    }

    const season = await prisma.vbsSeason.create({
      data: {
        name: SEASON_NAME,
        year: SEASON_YEAR,
        theme: "Basketball Summer Camp",
        startDate,
        endDate,
        isActive: openRegistration,
        publicRegistrationOpen: openRegistration,
        showOnPublicLanding: true,
        publicRegistrationSlug: SLUG,
        programKind: "SPORTS",
        classroomsEnabled: true,
        checkInEnabled: false,
        badgesEnabled: false,
        multiDayCheckInEnabled: false,
        dismissalTrackingEnabled: false,
      },
    });

    await prisma.publicRegistrationSettings.create({
      data: {
        seasonId: season.id,
        requireGuardianEmail: true,
        requireGuardianPhone: true,
        requireAllergiesNotes: false,
        welcomeMessage,
        sessionTimeDescription: "3:30 PM – 6:30 PM daily",
        helpContactName,
        helpContactEmail: process.env.VBS_HELP_EMAIL?.trim() || "bobojacob@gmail.com",
        publicHeaderLabel: SEASON_NAME,
        publicPageTitle: `${SEASON_NAME} | Registration`,
        publicPageDescription: "Register for the Basketball Summer Camp (grades 5–12).",
        participantSectionLabel: "Players",
        participantSingularLabel: "Player",
        contactSectionLabel: "Contact person",
        sessionPickerLabel: "Session",
      },
    });

    await prisma.registrationForm.create({
      data: {
        seasonId: season.id,
        title: `${SEASON_NAME} — registration`,
        welcomeMessage,
        confirmationMessage:
          "Thank you — your basketball camp registration was received. We look forward to seeing you July 28–30!",
        status: "PUBLISHED",
        draftDefinitionJson: formJson,
        publishedDefinitionJson: formJson,
        publishedVersion: 1,
        publishedAt: new Date(),
        waitlistEnabled: false,
        maxTotalRegistrations: CLASS_CAPACITY * 2,
        stripeCheckoutEnabled: true,
        stripeAmountCents: FEE_CENTS,
        stripePricingUnit: "PER_CHILD",
        stripeProductLabel: "Basketball Summer Camp 2026 registration",
        stripeProcessingFeeMode: "OPTIONAL",
        autoApproveWhenClassAssignedAndPaid: true,
        registrantLookupEnabled: true,
        adminRegistrationEditEnabled: true,
      },
    });

    await prisma.classroom.createMany({
      data: [
        {
          seasonId: season.id,
          name: "Boys",
          capacity: CLASS_CAPACITY,
          waitlistEnabled: false,
          ageMin: 0,
          ageMax: 99,
          useAgeRuleForAutoAssign: false,
          intakeStatus: "OPEN",
          sortOrder: 0,
          matchFormFieldKey: "playerGender",
          matchFormFieldValues: ["Boy"],
        },
        {
          seasonId: season.id,
          name: "Girls",
          capacity: CLASS_CAPACITY,
          waitlistEnabled: false,
          ageMin: 0,
          ageMax: 99,
          useAgeRuleForAutoAssign: false,
          intakeStatus: "OPEN",
          sortOrder: 1,
          matchFormFieldKey: "playerGender",
          matchFormFieldValues: ["Girl"],
        },
      ],
    });

    console.log(`Created season: ${SEASON_NAME} [${season.id}]`);
    console.log(`Public registration: /basketball`);
    console.log(`Classes: Boys (${CLASS_CAPACITY}), Girls (${CLASS_CAPACITY}) — registration closes when full`);
    if (!openRegistration) {
      console.log("\nRegistration is closed. Re-run with --open or enable it in admin when ready.");
    }
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
