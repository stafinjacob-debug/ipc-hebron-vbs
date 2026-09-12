/**
 * Deterministic checks for the HTC embedded-form template.
 * Run: npx tsx scripts/verify-embedded-htc-template.ts
 */
import { createHtcApplicationDefinition } from "../src/lib/embedded-form-htc-template";
import {
  adminOnlyFields,
  applicantVisibleFields,
  assertValidEmbeddedDefinition,
  embeddedDefinitionToJson,
  isFillableEmbeddedField,
} from "../src/lib/embedded-form-definition";
import { parseEmbeddedApplicantForm } from "../src/lib/embedded-form-validate";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const def = createHtcApplicationDefinition();
assertValidEmbeddedDefinition(embeddedDefinitionToJson(def));

const applicantKeys = new Set(
  applicantVisibleFields(def).filter(isFillableEmbeddedField).map((f) => f.key),
);
const requiredKeys = [
  "passportPhoto",
  "fullName",
  "sex",
  "dobDay",
  "dobMonth",
  "dobYear",
  "nationality",
  "state",
  "occupation",
  "primaryLanguage",
  "addressLine1",
  "addressCity",
  "addressState",
  "addressZip",
  "email",
  "phone",
  "fatherGuardianName",
  "maritalStatus",
  "spouseName",
  "dateOfMarriage",
  "child1NameAge",
  "churchAffiliation",
  "localChurchNameAddress",
  "localChurchAddressLine",
  "localChurchCity",
  "localChurchState",
  "localChurchZip",
  "receivedJesusWhen",
  "waterBaptismWhen",
  "filledWithHolySpirit",
  "definiteCallForService",
  "ordainedPastor",
  "sinceHighSchool",
  "christianMinistryDetails",
  "educationEntries",
  "personalTestimony",
  "academicDocuments",
  "whyJoinProgramme",
  "refPastorName",
  "refPastorAddress",
  "refPastorCity",
  "refPastorState",
  "refPastorZip",
  "refPastorPhone",
  "refOfficialName",
  "refOfficialAddress",
  "refOfficialCity",
  "refOfficialState",
  "refOfficialZip",
  "refOfficialPhone",
  "refFriendName",
  "refFriendAddress",
  "refFriendCity",
  "refFriendState",
  "refFriendZip",
  "refFriendPhone",
  "declarationAccepted",
  "declarationName",
  "applicantSignatureDate",
  "applicantSignature",
];
for (const key of requiredKeys) {
  assert(applicantKeys.has(key), `Missing applicant field: ${key}`);
}

const adminKeys = new Set(adminOnlyFields(def).map((f) => f.key));
for (const key of [
  "registrarDateReceived",
  "registrarFeesReceived",
  "registrarApplicationNumber",
  "registrarAdmissionDecision",
  "registrarDecisionDate",
  "registrarSignature",
]) {
  assert(adminKeys.has(key), `Missing registrar field: ${key}`);
  assert(!applicantKeys.has(key), `Registrar field leaked to applicant: ${key}`);
}

const registrarSection = def.sections.find((s) => s.id === "sec_registrar");
assert(registrarSection?.adminOnly === true, "Registrar section must be adminOnly");

const health = def.fields.find((f) => f.key === "healthConditions");
assert(health?.type === "checkboxGroup", "healthConditions should be checkboxGroup");
assert((health.options?.length ?? 0) === 24, "Expected 24 health conditions");

const education = def.fields.find((f) => f.key === "educationEntries");
assert(education?.type === "educationEntries", "educationEntries field missing");
const docs = def.fields.find((f) => f.key === "academicDocuments");
assert(docs?.type === "documentUploads", "academicDocuments field missing");
assert(docs?.sectionId === "sec_submission", "academicDocuments should be on submission section");
const photo = def.fields.find((f) => f.key === "passportPhoto");
assert(photo?.type === "photo", "passportPhoto field missing");
assert(photo?.sectionId === "sec_personal", "passportPhoto should be on personal section");
const testimony = def.fields.find((f) => f.key === "personalTestimony");
assert(testimony?.type === "textarea", "personalTestimony field missing");
const submissionSection = def.sections.find((s) => s.id === "sec_submission");
assert(!!submissionSection, "sec_submission missing");
assert(!submissionSection.adminOnly, "submission section must be applicant-visible");
assert(
  !def.fields.some((f) => f.sectionId === "sec_submission" && f.type === "photo"),
  "submission section should not include passport photo",
);

assert(!applicantKeys.has("addressLine2"), "personal address should use city/state/ZIP fields");
assert(def.fields.find((f) => f.key === "dateOfMarriage")?.type === "date", "dateOfMarriage should be a date picker");
assert(def.fields.find((f) => f.key === "receivedJesusWhen")?.type === "date", "receivedJesusWhen should be a date picker");
assert(def.fields.find((f) => f.key === "waterBaptismWhen")?.type === "date", "waterBaptismWhen should be a date picker");
assert(def.fields.find((f) => f.key === "declarationName")?.label === "Full legal name", "declaration should ask for legal name once");
assert(def.fields.find((f) => f.key === "applicantSignature")?.type === "signatureTyped", "applicantSignature should remain for generated signature");

assert(!applicantKeys.has("motherTongue"), "motherTongue should be primaryLanguage");
assert(!applicantKeys.has("fatherGuardianAddress"), "father/guardian address was removed");
assert(!applicantKeys.has("fatherGuardianOccupation"), "father/guardian occupation was removed");
const marital = def.fields.find((f) => f.key === "maritalStatus");
assert(marital?.label.startsWith("9."), "maritalStatus should be field 9");
const spouse = def.fields.find((f) => f.key === "spouseName");
assert(spouse?.label.startsWith("10."), "spouseName should be field 10");
assert(spouse?.showWhen?.equals === "Married", "spouseName should show when Married");
const child1 = def.fields.find((f) => f.key === "child1NameAge");
assert(child1?.showWhen?.equals === "Married", "children should show when Married");
const dobMonth = def.fields.find((f) => f.key === "dobMonth");
const dobDay = def.fields.find((f) => f.key === "dobDay");
assert((dobMonth?.order ?? 99) < (dobDay?.order ?? 0), "DOB should be Month then Day");
const primaryLang = def.fields.find((f) => f.key === "primaryLanguage");
assert(primaryLang?.label === "Primary language", "primaryLanguage label mismatch");
const country = def.fields.find((f) => f.key === "county");
assert(country?.label === "Country", "county field should be labeled Country");
assert((testimony?.validation?.minLength ?? 0) === 40, "personalTestimony should require 40 characters");

const ordination = def.fields.find((f) => f.key === "ordinationDetails");
assert(ordination?.showWhen?.fieldKey === "ordainedPastor", "ordinationDetails conditional missing");

// Validation: missing required fields fails
const empty = new FormData();
const fail = parseEmbeddedApplicantForm(def, empty);
assert(!fail.ok, "Empty form should fail validation");

console.log("verify-embedded-htc-template: OK");
console.log(`  applicant fillable fields: ${applicantKeys.size}`);
console.log(`  admin fields: ${adminKeys.size}`);
console.log(`  sections: ${def.sections.length}`);
