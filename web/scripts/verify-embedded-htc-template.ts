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
  "motherTongue",
  "addressLine1",
  "email",
  "phone",
  "fatherGuardianName",
  "fatherGuardianAddress",
  "fatherGuardianOccupation",
  "maritalStatus",
  "spouseName",
  "dateOfMarriage",
  "child1NameAge",
  "churchAffiliation",
  "localChurchNameAddress",
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
  "refPastorPhone",
  "refOfficialName",
  "refOfficialAddress",
  "refOfficialPhone",
  "refFriendName",
  "refFriendAddress",
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

const spouse = def.fields.find((f) => f.key === "spouseName");
assert(spouse?.showWhen?.equals === "Married", "spouseName should show when Married");
const child1 = def.fields.find((f) => f.key === "child1NameAge");
assert(child1?.showWhen?.equals === "Married", "children should show when Married");

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
