/**
 * Create and configure the Weekday Soccer interest form (soccer camp families).
 *
 * Usage (from web/):
 *   npx dotenv -e .env.local -- tsx scripts/setup-soccer-weekday-interest.ts --database=vbs_production
 *   npx dotenv -e .env.local -- tsx scripts/setup-soccer-weekday-interest.ts --database=vbs_production --dry-run
 *   npx dotenv -e .env.local -- tsx scripts/setup-soccer-weekday-interest.ts --database=vbs_production --open
 *   npx dotenv -e .env.local -- tsx scripts/setup-soccer-weekday-interest.ts --database=vbs_production --close
 *
 * Production (events.ipchouston.com): GitHub workflow "Setup Soccer Weekday Interest (Production)"
 * with PROD_DATABASE_URL.
 */
import { config } from "dotenv";
import { existsSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { fromDatetimeLocalValueInAppTz } from "../src/lib/app-timezone";
import {
  definitionToJson,
  type FormDefinitionV1,
} from "../src/lib/registration-form-definition";
import { parseLocalDate } from "../src/lib/schemas/vbs-registration";

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
if (existsSync(resolve(webRoot, ".env.local"))) {
  config({ path: resolve(webRoot, ".env.local") });
}

const SEASON_NAME = "Weekday Soccer at Church — Interest Form";
const SEASON_YEAR = 2026;
const SLUG = "soccer-weekday";
const START_DATE = "2026-08-13";
const END_DATE = "2026-08-27";
/** Form closes two weeks after launch (America/Chicago). */
const REGISTRATION_CLOSES_LOCAL = "2026-08-27T23:59";

function parseArgs() {
  const dryRun = process.argv.includes("--dry-run");
  const openRegistration = process.argv.includes("--open");
  const closeRegistration = process.argv.includes("--close");
  if (openRegistration && closeRegistration) {
    throw new Error("Use either --open or --close, not both.");
  }
  const dbArg = process.argv.find((a) => a.startsWith("--database="));
  const database = dbArg?.slice("--database=".length).trim() || null;
  return { dryRun, openRegistration, closeRegistration, database };
}

function resolveDatabaseUrl(database: string | null): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required (set in web/.env.local).");
  if (!database) return url;
  return url.replace(/\/[^/?]+(\?|$)/, `/${database}$1`);
}

function buildWelcomeMessage(): string {
  return (
    "Weekday Soccer at Church\n\n" +
    "If your child attended soccer camp and you are interested in weekday soccer at IPC Hebron, " +
    "please share your contact information below. This helps us plan and add you to a WhatsApp group for updates.\n\n" +
    "This form is open for two weeks only."
  );
}

function buildFormDefinition(): FormDefinitionV1 {
  return {
    version: 1,
    sections: [
      {
        id: "sec_info",
        title: "About this form",
        description: "",
        audience: "static",
        order: 0,
      },
      {
        id: "sec_guardian",
        title: "Parent / guardian",
        description: "We'll use this to follow up and add you to the WhatsApp group.",
        audience: "guardian",
        order: 1,
      },
      {
        id: "sec_child",
        title: "Your children",
        description: "Add each child who may participate in weekday soccer.",
        audience: "eachChild",
        order: 2,
      },
    ],
    fields: [
      {
        id: "f_info",
        sectionId: "sec_info",
        key: "interestInfo",
        type: "staticText",
        label: "",
        required: false,
        order: 0,
        helperText:
          "This is not a registration — we are collecting interest only. " +
          "Someone from the church will contact you with next steps.",
      },
      {
        id: "f_g_name",
        sectionId: "sec_guardian",
        key: "pname",
        type: "text",
        label: "Your name",
        required: true,
        order: 0,
        placeholder: "First and last name",
      },
      {
        id: "f_g_ph",
        sectionId: "sec_guardian",
        key: "guardianPhone",
        type: "tel",
        label: "Phone number (for WhatsApp group)",
        required: true,
        order: 1,
        placeholder: "(555) 123-4567",
        helperText: "Include your mobile number so we can add you to the parent WhatsApp group.",
      },
      {
        id: "f_c_name",
        sectionId: "sec_child",
        key: "childFirstName",
        type: "text",
        label: "Child's name",
        required: true,
        order: 0,
      },
      {
        id: "f_c_age",
        sectionId: "sec_child",
        key: "childAge",
        type: "number",
        label: "Age",
        required: true,
        order: 1,
        placeholder: "e.g. 8",
      },
    ],
  };
}

async function main() {
  const { dryRun, openRegistration, closeRegistration, database } = parseArgs();
  const url = resolveDatabaseUrl(database);
  if (database) console.log(`Database: ${database}`);
  if (dryRun) console.log("DRY RUN — no database writes.\n");

  const registrationClosesAt = fromDatetimeLocalValueInAppTz(REGISTRATION_CLOSES_LOCAL);
  if (!registrationClosesAt) {
    throw new Error(`Invalid registration close datetime: ${REGISTRATION_CLOSES_LOCAL}`);
  }

  const pool = new Pool({ connectionString: url, connectionTimeoutMillis: 120_000 });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const existing = await prisma.vbsSeason.findFirst({
      where: {
        OR: [{ publicRegistrationSlug: SLUG }, { name: SEASON_NAME }],
      },
      select: {
        id: true,
        name: true,
        publicRegistrationSlug: true,
        publicRegistrationOpen: true,
      },
    });

    const formDef = buildFormDefinition();
    const formJson = definitionToJson(formDef);
    const welcomeMessage = buildWelcomeMessage();
    const helpContactEmail = process.env.VBS_HELP_EMAIL?.trim() || "soccer@ipchouston.com";

    if (existing) {
      if (!dryRun) {
        await prisma.vbsSeason.update({
          where: { id: existing.id },
          data: {
            publicRegistrationSlug: SLUG,
            startDate: parseLocalDate(START_DATE),
            endDate: parseLocalDate(END_DATE),
            ...(openRegistration || closeRegistration
              ? { publicRegistrationOpen: openRegistration }
              : {}),
          },
        });
        await prisma.registrationForm.update({
          where: { seasonId: existing.id },
          data: {
            draftDefinitionJson: formJson,
            publishedDefinitionJson: formJson,
            publishedVersion: { increment: 1 },
            publishedAt: new Date(),
            status: "PUBLISHED",
            registrationClosesAt,
            welcomeMessage,
          },
        });
        await prisma.publicRegistrationSettings.upsert({
          where: { seasonId: existing.id },
          create: {
            seasonId: existing.id,
            requireGuardianEmail: false,
            requireGuardianPhone: true,
            welcomeMessage,
            helpContactEmail,
            publicHeaderLabel: SEASON_NAME,
            publicPageTitle: `${SEASON_NAME} | IPC Hebron`,
            publicPageDescription:
              "Share your interest in weekday soccer at church for children who attended soccer camp.",
            participantSectionLabel: "Children",
            participantSingularLabel: "Child",
            contactSectionLabel: "Parent / guardian",
          },
          update: {
            requireGuardianEmail: false,
            requireGuardianPhone: true,
            welcomeMessage,
            helpContactEmail,
          },
        });
      }
      if (openRegistration || closeRegistration) {
        console.log(
          `Public registration: ${existing.publicRegistrationOpen ? "open" : "closed"} → ${openRegistration ? "open" : "closed"}`,
        );
      } else {
        console.log(
          `Public registration: ${existing.publicRegistrationOpen ? "open" : "closed"} (unchanged — pass --open or --close to change)`,
        );
      }
      console.log(`Season already exists: ${existing.name} [${existing.id}]`);
      console.log(`Public URL: /soccer-weekday`);
      console.log(`Closes: ${REGISTRATION_CLOSES_LOCAL} America/Chicago`);
      return;
    }

    const startDate = parseLocalDate(START_DATE);
    const endDate = parseLocalDate(END_DATE);

    if (dryRun) {
      console.log("Would create:");
      console.log(`  Season: ${SEASON_NAME} (${SEASON_YEAR})`);
      console.log(`  Slug: ${SLUG} (public URL /soccer-weekday)`);
      console.log(`  Interest window closes: ${REGISTRATION_CLOSES_LOCAL} America/Chicago`);
      console.log(`  Open registration: ${openRegistration}`);
      console.log(`  Form fields: ${formDef.fields.length}`);
      return;
    }

    const season = await prisma.vbsSeason.create({
      data: {
        name: SEASON_NAME,
        year: SEASON_YEAR,
        theme: "Weekday Soccer",
        startDate,
        endDate,
        isActive: openRegistration,
        publicRegistrationOpen: openRegistration,
        showOnPublicLanding: true,
        publicRegistrationSlug: SLUG,
        programKind: "SPORTS",
        classroomsEnabled: false,
        checkInEnabled: false,
        badgesEnabled: false,
        multiDayCheckInEnabled: false,
        dismissalTrackingEnabled: false,
      },
    });

    await prisma.publicRegistrationSettings.create({
      data: {
        seasonId: season.id,
        requireGuardianEmail: false,
        requireGuardianPhone: true,
        requireAllergiesNotes: false,
        welcomeMessage,
        helpContactEmail,
        publicHeaderLabel: SEASON_NAME,
        publicPageTitle: `${SEASON_NAME} | IPC Hebron`,
        publicPageDescription:
          "Share your interest in weekday soccer at church for children who attended soccer camp.",
        participantSectionLabel: "Children",
        participantSingularLabel: "Child",
        contactSectionLabel: "Parent / guardian",
        publicContactFooterText: "Questions? Email soccer@ipchouston.com",
      },
    });

    await prisma.registrationForm.create({
      data: {
        seasonId: season.id,
        title: `${SEASON_NAME}`,
        welcomeMessage,
        confirmationMessage:
          "Thank you — we received your interest in weekday soccer at church. " +
          "We'll be in touch soon and will add your phone number to the parent WhatsApp group.",
        status: "PUBLISHED",
        draftDefinitionJson: formJson,
        publishedDefinitionJson: formJson,
        publishedVersion: 1,
        publishedAt: new Date(),
        registrationOpensAt: new Date(),
        registrationClosesAt,
        waitlistEnabled: false,
        maxTotalRegistrations: null,
        stripeCheckoutEnabled: false,
        registrantLookupEnabled: false,
        adminRegistrationEditEnabled: true,
        autoApproveWhenClassAssignedAndPaid: false,
      },
    });

    console.log(`Created season: ${SEASON_NAME} [${season.id}]`);
    console.log(`Public registration: /soccer-weekday`);
    console.log(`Closes: ${REGISTRATION_CLOSES_LOCAL} America/Chicago`);
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
