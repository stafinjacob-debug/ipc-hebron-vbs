/**
 * Create and configure IPC Hebron Youth Retreat, United '26 registration portal.
 *
 * Usage (from web/):
 *   # Real production (events.ipchouston.com) — use PROD_DATABASE_URL via GitHub Actions:
 *   #   workflow: Setup Youth Retreat United 26 (Production)
 *   # Or locally when you have the prod connection string:
 *   DATABASE_URL="$PROD_DATABASE_URL" npx tsx scripts/setup-youth-retreat-united-26.ts
 *   DATABASE_URL="$PROD_DATABASE_URL" npx tsx scripts/setup-youth-retreat-united-26.ts --dry-run
 *   DATABASE_URL="$PROD_DATABASE_URL" npx tsx scripts/setup-youth-retreat-united-26.ts --open
 *
 *   # Dev Azure DB only (NOT the live admin site):
 *   npx dotenv -e .env.local -- tsx scripts/setup-youth-retreat-united-26.ts --database=vbs_production
 *
 * `--open` sets publicRegistrationOpen and isActive after setup (default: leaves registration closed).
 *
 * Note: The live site uses GitHub secret PROD_DATABASE_URL (rg-ipc-hebron-vbs-prod). The
 * `--database=vbs_production` flag only retargets the shared dev Azure server and is NOT
 * the same database as events.ipchouston.com admin.
 *
 * Placeholder event dates (Fri–Sun after the Aug 31 deadline) can be edited in admin.
 * Digital waiver is left disabled until camp + challenge-course text is pasted in Form settings.
 */
import { config } from "dotenv";
import { existsSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { PrismaClient, Prisma } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { fromDatetimeLocalValueInAppTz } from "../src/lib/app-timezone";
import {
  definitionToJson,
  type FormDefinitionV1,
} from "../src/lib/registration-form-definition";
import { parseLocalDate } from "../src/lib/schemas/vbs-registration";
import {
  YOUTH_RETREAT_WAIVER_BODY,
  YOUTH_RETREAT_WAIVER_DESCRIPTION,
  YOUTH_RETREAT_WAIVER_TITLE,
} from "./youth-retreat-waiver-content";

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
if (existsSync(resolve(webRoot, ".env.local"))) {
  config({ path: resolve(webRoot, ".env.local") });
}

const SEASON_NAME = "IPC Hebron Youth Retreat, United '26";
const SEASON_YEAR = 2026;
const SLUG = "retreat";
const LEGACY_SLUG = "united-26";
const THEME = "United '26";
const START_DATE = "2026-09-25";
const END_DATE = "2026-09-27";
const FEE_CENTS = 15200;
const REGISTRATION_CLOSES_LOCAL = "2026-08-31T23:59";
/** Shown under the date range on the public registration hero (clock line). */
const SESSION_TIME_DESCRIPTION =
  "Eligible: 9th–12th grade & HYA (College) · Fees: $152 per participant";

const PAY_LATER_MESSAGE =
  "You chose to pay later. Please complete payment by August 31, 2026 — you can pay by card online by then, pay by Zelle, or arrange payment with the registration managers.\n\n" +
  "Pay by Zelle: cash@ipchouston.com — please include the participant name(s) and “Youth Retreat United '26” in the memo so we can match your payment.\n\n" +
  "No student will be turned away due to cost. We believe every student should have the opportunity to encounter God this weekend. " +
  "If finances are a barrier, please reach out to Pastor Danny privately — scholarships covering 25%, 50%, and 75% are available. " +
  "We don't want finances to be the reason you miss what God has in store for you — we want you there!";

const PAYMENT_DEADLINE_NOTICE =
  "To finalize your Youth Retreat registration, payment must be received by August 31, 2026. Unpaid registrations may not be eligible to attend.";

/** One contact per line — rendered as multiple “Contact persons” on the public form. */
const HELP_CONTACT_NAME =
  "Pastor Danny Varghese 405-824-1231\nJessena Varghese 516-263-6039\nJoyce John 832-577-6241";
const HELP_CONTACT_PHONE = "832-577-6241";

const WAIVER_MERGE_FIELD_KEYS = [
  "guardianFirstName",
  "guardianLastName",
  "guardianEmail",
  "guardianPhone",
  "childFirstName",
  "childLastName",
  "childDateOfBirth",
  "registrantPhone",
  "registrantEmail",
  "participantGender",
  "participantGroup",
];

const TSHIRT_OPTIONS = [
  { value: "S", label: "S" },
  { value: "M", label: "M" },
  { value: "L", label: "L" },
  { value: "XL", label: "XL" },
  { value: "XXL", label: "XXL" },
  { value: "3XL", label: "3XL" },
  { value: "4XL", label: "4XL" },
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

function buildWelcomeMessage(): string {
  return (
    "IPC Hebron Youth Retreat, United '26\n" +
    "9th–12th grade & HYA (College) · $152 per participant\n\n" +
    "Church Bus will leave Friday around 5:15 PM from IPC Hebron and return to IPC Hebron, 3:30 PM Sunday.\n\n" +
    "Primary contacts: Pastor Danny Varghese 405-824-1231 · Jessena Varghese 516-263-6039 · Joyce John 832-577-6241\n" +
    "Registration managers: Joyce John & Jessena Varghese"
  );
}

function buildInstructions(): string {
  return (
    "Eligible: 9th–12th grade & HYA (College).\n\n" +
    "Church Bus will leave Friday around 5:15 PM from IPC Hebron and return to IPC Hebron, 3:30 PM Sunday.\n\n" +
    "No student will be turned away due to cost. We believe every student should have the opportunity to encounter God this weekend. " +
    "If finances are a barrier, please reach out to Pastor Danny privately — scholarships covering 25%, 50%, and 75% are available. " +
    "We don't want finances to be the reason you miss what God has in store for you — we want you there!\n\n" +
    "Registration managers: Joyce John & Jessena Varghese.\n" +
    "Primary contacts: Pastor Danny Varghese 405-824-1231 · Jessena Varghese 516-263-6039 · Joyce John 832-577-6241.\n\n" +
    "An information packet will be sent after registration is confirmed (once available)."
  );
}

function buildFormDefinition(): FormDefinitionV1 {
  return {
    version: 1,
    sections: [
      {
        id: "sec_info",
        title: "Important information",
        description: "",
        audience: "static",
        order: 0,
      },
      {
        id: "sec_guardian",
        title: "Guardian / parent contact",
        description: "We'll use this for retreat updates and emergencies.",
        audience: "guardian",
        order: 1,
      },
      {
        id: "sec_child",
        title: "Participant",
        description: "Add each person registering for the retreat.",
        audience: "eachChild",
        order: 2,
      },
      {
        id: "sec_consent",
        title: "Consent",
        description: "",
        audience: "consent",
        order: 3,
      },
    ],
    fields: [
      {
        id: "f_info_static",
        sectionId: "sec_info",
        key: "retreatInfoNotice",
        type: "staticText",
        label: "Retreat details",
        required: false,
        order: 0,
        helperText:
          "Church Bus leaves Friday ~5:15 PM from IPC Hebron and returns Sunday 3:30 PM. " +
          "No student will be turned away due to cost. We believe every student should have the opportunity to encounter God this weekend. " +
          "If finances are a barrier, please reach out to Pastor Danny privately — scholarships covering 25%, 50%, and 75% are available. " +
          "We don't want finances to be the reason you miss what God has in store for you — we want you there! " +
          "You may also choose Pay later at checkout (payment due by August 31, 2026).",
      },
      {
        id: "f_g_fn",
        sectionId: "sec_guardian",
        key: "guardianFirstName",
        type: "text",
        label: "Guardian first name",
        required: true,
        order: 0,
      },
      {
        id: "f_g_ln",
        sectionId: "sec_guardian",
        key: "guardianLastName",
        type: "text",
        label: "Guardian last name",
        required: true,
        order: 1,
      },
      {
        id: "f_g_ph",
        sectionId: "sec_guardian",
        key: "guardianPhone",
        type: "tel",
        label: "Guardian phone",
        required: true,
        order: 2,
        placeholder: "(555) 123-4567",
      },
      {
        id: "f_g_em",
        sectionId: "sec_guardian",
        key: "guardianEmail",
        type: "email",
        label: "Guardian email",
        required: true,
        order: 3,
        placeholder: "name@example.com",
      },
      {
        id: "f_c_fn",
        sectionId: "sec_child",
        key: "childFirstName",
        type: "text",
        label: "Registrant first name",
        required: true,
        order: 0,
      },
      {
        id: "f_c_ln",
        sectionId: "sec_child",
        key: "childLastName",
        type: "text",
        label: "Registrant last name",
        required: true,
        order: 1,
      },
      {
        id: "f_c_dob",
        sectionId: "sec_child",
        key: "childDateOfBirth",
        type: "date",
        label: "Date of birth",
        required: true,
        order: 2,
      },
      {
        id: "f_c_age",
        sectionId: "sec_child",
        key: "registrantAge",
        type: "number",
        label: "Age",
        required: true,
        order: 3,
        validation: { min: 1, max: 99 },
      },
      {
        id: "f_c_ph",
        sectionId: "sec_child",
        key: "registrantPhone",
        type: "tel",
        label: "Registrant phone",
        required: true,
        order: 4,
        placeholder: "(555) 123-4567",
      },
      {
        id: "f_c_em",
        sectionId: "sec_child",
        key: "registrantEmail",
        type: "email",
        label: "Registrant email",
        required: true,
        order: 5,
        placeholder: "name@example.com",
      },
      {
        id: "f_c_gender",
        sectionId: "sec_child",
        key: "participantGender",
        type: "select",
        label: "Gender",
        required: true,
        order: 6,
        options: [
          { value: "Male", label: "Male" },
          { value: "Female", label: "Female" },
        ],
      },
      {
        id: "f_c_group",
        sectionId: "sec_child",
        key: "participantGroup",
        type: "select",
        label: "Registration group",
        required: true,
        order: 7,
        helperText: "Highschool (9th–12th grade), College / HYA, or Volunteer.",
        options: [
          { value: "Highschool", label: "Highschool (9th–12th)" },
          { value: "College", label: "College / HYA" },
          { value: "Volunteer", label: "Volunteer" },
        ],
      },
      {
        id: "f_c_alg",
        sectionId: "sec_child",
        key: "allergiesNotes",
        type: "textarea",
        label: "Any allergies or dietary restrictions?",
        required: false,
        order: 8,
        placeholder: "None, or describe allergies / dietary needs",
      },
      {
        id: "f_c_meds",
        sectionId: "sec_child",
        key: "currentMedications",
        type: "textarea",
        label: "Are you currently taking any medications?",
        required: false,
        order: 9,
        placeholder: "None, or list medications",
      },
      {
        id: "f_c_med_alg",
        sectionId: "sec_child",
        key: "medicationAllergies",
        type: "textarea",
        label: "Are you allergic to any medications?",
        required: false,
        order: 10,
        placeholder: "None, or list medication allergies",
      },
      {
        id: "f_c_bus",
        sectionId: "sec_child",
        key: "churchBus",
        type: "select",
        label: "Will you be utilizing the church bus for transportation?",
        required: true,
        order: 11,
        options: [
          { value: "Yes", label: "Yes" },
          { value: "No", label: "No" },
        ],
      },
      {
        id: "f_c_transport",
        sectionId: "sec_child",
        key: "transportOther",
        type: "textarea",
        label: "If not, how will you be transported?",
        required: true,
        order: 12,
        helperText:
          "Highschool students must use the church bus or be dropped off / picked up by a parent.",
        placeholder: "Describe transportation plans",
        showWhen: { fieldKey: "churchBus", equals: "No" },
      },
      {
        id: "f_c_shirt",
        sectionId: "sec_child",
        key: "tshirtSize",
        type: "select",
        label: "T-shirt size",
        required: true,
        order: 13,
        options: [...TSHIRT_OPTIONS],
      },
      {
        id: "f_c_notes",
        sectionId: "sec_child",
        key: "additionalNotes",
        type: "textarea",
        label: "Anything else you would like for us to know before camp?",
        required: false,
        order: 14,
        placeholder: "Optional",
      },
    ],
  };
}

async function main() {
  const { dryRun, openRegistration, database } = parseArgs();
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
        OR: [
          { publicRegistrationSlug: SLUG },
          { publicRegistrationSlug: LEGACY_SLUG },
          { name: SEASON_NAME },
        ],
      },
      select: { id: true, name: true, publicRegistrationSlug: true },
    });
    if (existing) {
      const formDef = buildFormDefinition();
      const formJson = definitionToJson(formDef);
      const startDate = parseLocalDate(START_DATE);
      const endDate = parseLocalDate(END_DATE);
      if (existing.publicRegistrationSlug !== SLUG) {
        if (!dryRun) {
          await prisma.vbsSeason.update({
            where: { id: existing.id },
            data: { publicRegistrationSlug: SLUG },
          });
        }
        console.log(
          `Updated slug: ${existing.publicRegistrationSlug ?? "(none)"} → ${SLUG}`,
        );
      }
      if (!dryRun) {
        await prisma.vbsSeason.update({
          where: { id: existing.id },
          data: { startDate, endDate },
        });
        await prisma.registrationForm.update({
          where: { seasonId: existing.id },
          data: {
            draftDefinitionJson: formJson,
            publishedDefinitionJson: formJson,
            publishedVersion: { increment: 1 },
            publishedAt: new Date(),
            status: "PUBLISHED",
            waiverEnabled: true,
            waiverTitle: YOUTH_RETREAT_WAIVER_TITLE,
            waiverDescription: YOUTH_RETREAT_WAIVER_DESCRIPTION,
            waiverBody: YOUTH_RETREAT_WAIVER_BODY,
            waiverMergeFieldKeys: WAIVER_MERGE_FIELD_KEYS,
            stripeCheckoutEnabled: true,
            stripeAmountCents: FEE_CENTS,
            stripePricingUnit: "PER_CHILD",
            stripePayLaterEnabled: true,
            stripePayLaterMessage: PAY_LATER_MESSAGE,
            stripePaymentDeadlineNotice: PAYMENT_DEADLINE_NOTICE,
            stripeAutoPayLaterWhenFieldKey: null,
            stripeAutoPayLaterWhenFieldValues: Prisma.DbNull,
            minimumParticipantAgeYears: null,
            maximumParticipantAgeYears: null,
            welcomeMessage: buildWelcomeMessage(),
            instructions: buildInstructions(),
          },
        });
        await prisma.publicRegistrationSettings.update({
          where: { seasonId: existing.id },
          data: {
            sessionTimeDescription: SESSION_TIME_DESCRIPTION,
            helpContactName: HELP_CONTACT_NAME,
            helpContactPhone: HELP_CONTACT_PHONE,
            welcomeMessage: buildWelcomeMessage(),
          },
        });
      }
      console.log(`Season already exists: ${existing.name} [${existing.id}]`);
      console.log(`Public URL: /register/${SLUG}`);
      console.log(`Dates: ${START_DATE} – ${END_DATE}`);
      console.log(`Session line: ${SESSION_TIME_DESCRIPTION}`);
      console.log("Contact persons: Pastor Danny, Jessena Varghese, Joyce John (with phones)");
      console.log("Pay later: enabled for everyone (scholarship dropdowns removed).");
      console.log("Waiver enabled: General Liability + Challenge Course (combined digital signature).");
      return;
    }

    const startDate = parseLocalDate(START_DATE);
    const endDate = parseLocalDate(END_DATE);
    const formDef = buildFormDefinition();
    const formJson = definitionToJson(formDef);
    const welcomeMessage = buildWelcomeMessage();
    const instructions = buildInstructions();
    const helpContactName = HELP_CONTACT_NAME;
    const helpContactPhone = HELP_CONTACT_PHONE;
    const helpContactEmail = process.env.VBS_HELP_EMAIL?.trim() || "info@ipchebron.com";

    if (dryRun) {
      console.log("Would create:");
      console.log(`  Season: ${SEASON_NAME} (${SEASON_YEAR})`);
      console.log(`  Slug: ${SLUG} (public URL /${SLUG})`);
      console.log(`  Placeholder dates: ${START_DATE} – ${END_DATE} (edit in admin)`);
      console.log(`  Fee: $${FEE_CENTS / 100} per participant`);
      console.log(`  Registration closes: ${REGISTRATION_CLOSES_LOCAL} America/Chicago`);
      console.log(`  Classrooms: disabled (gender + group as form fields only)`);
      console.log(`  Waiver: enabled (General Liability + Challenge Course combined)`);
      console.log(`  Contact: ${helpContactName} · ${helpContactPhone} · ${helpContactEmail}`);
      console.log(`  Open registration: ${openRegistration}`);
      console.log(`  Form fields: ${formDef.fields.length}`);
      return;
    }

    const season = await prisma.vbsSeason.create({
      data: {
        name: SEASON_NAME,
        year: SEASON_YEAR,
        theme: THEME,
        startDate,
        endDate,
        isActive: openRegistration,
        publicRegistrationOpen: openRegistration,
        showOnPublicLanding: true,
        publicRegistrationSlug: SLUG,
        programKind: "YOUTH",
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
        requireGuardianEmail: true,
        requireGuardianPhone: true,
        requireAllergiesNotes: false,
        welcomeMessage,
        sessionTimeDescription: SESSION_TIME_DESCRIPTION,
        helpContactName,
        helpContactEmail,
        helpContactPhone,
        publicHeaderLabel: SEASON_NAME,
        publicPageTitle: `${SEASON_NAME} | Registration`,
        publicPageDescription:
          "Register for IPC Hebron Youth Retreat, United '26 (9th–12th grade & HYA).",
        participantSectionLabel: "Participants",
        participantSingularLabel: "Participant",
        contactSectionLabel: "Guardian / parent contact",
        sessionPickerLabel: "Session",
      },
    });

    await prisma.registrationForm.create({
      data: {
        seasonId: season.id,
        title: `${SEASON_NAME} — registration`,
        welcomeMessage,
        instructions,
        confirmationMessage:
          "Thank you — your Youth Retreat registration was received. An information packet will be sent once it is ready. We look forward to seeing you!",
        status: "PUBLISHED",
        draftDefinitionJson: formJson,
        publishedDefinitionJson: formJson,
        publishedVersion: 1,
        publishedAt: new Date(),
        registrationClosesAt,
        waitlistEnabled: false,
        maxTotalRegistrations: null,
        stripeCheckoutEnabled: true,
        stripeAmountCents: FEE_CENTS,
        stripePricingUnit: "PER_CHILD",
        stripeProductLabel: "Youth Retreat United '26 registration",
        stripeProcessingFeeMode: "OPTIONAL",
        stripePayLaterEnabled: true,
        stripePayLaterMessage: PAY_LATER_MESSAGE,
        stripePaymentDeadlineNotice: PAYMENT_DEADLINE_NOTICE,
        stripeAutoPayLaterWhenFieldKey: null,
        stripeAutoPayLaterWhenFieldValues: Prisma.DbNull,
        minimumParticipantAgeYears: null,
        maximumParticipantAgeYears: null,
        autoApproveWhenClassAssignedAndPaid: false,
        registrantLookupEnabled: true,
        adminRegistrationEditEnabled: true,
        waiverEnabled: true,
        waiverTitle: YOUTH_RETREAT_WAIVER_TITLE,
        waiverDescription: YOUTH_RETREAT_WAIVER_DESCRIPTION,
        waiverBody: YOUTH_RETREAT_WAIVER_BODY,
        waiverMergeFieldKeys: WAIVER_MERGE_FIELD_KEYS,
      },
    });

    console.log(`Created season: ${SEASON_NAME} [${season.id}]`);
    console.log(`Public registration: /register/${SLUG}`);
    console.log(`Fee: $${FEE_CENTS / 100} per participant · closes ${REGISTRATION_CLOSES_LOCAL} CT`);
    console.log("Waiver enabled: General Liability + Challenge Course (combined digital signature).");
    console.log("Pay later: enabled for everyone (contact Pastor Danny privately for scholarship help).");
    console.log("Event dates set — update in Programs if they change.");
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
