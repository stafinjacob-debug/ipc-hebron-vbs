/**
 * Smoke-test PDF overlay generation for the HTC template.
 * Run: npx tsx scripts/smoke-embedded-pdf.ts
 */
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { renderEmbeddedApplicationPdf } from "../src/lib/embedded-form-pdf";

async function main() {
  const buf = await renderEmbeddedApplicationPdf({
    templateKey: "htc-application",
    applicationNumber: "HTC-2026-001",
    applicantFullName: "JOHN SAMPLE APPLICANT",
    signatureTypedName: "John Sample Applicant",
    responses: {
      fullName: "JOHN SAMPLE APPLICANT",
      sex: "Male",
      dobDay: 12,
      dobMonth: 3,
      dobYear: 1990,
      ageNow: 36,
      nationality: "United States",
      state: "Texas",
      county: "Harris",
      occupation: "Teacher",
      primaryLanguage: "English",
      otherLanguages: "Spanish, Malayalam",
      addressLine1: "123 Main Street",
      addressCity: "Houston",
      addressState: "TX",
      addressZip: "77001",
      email: "john.sample@example.com",
      phone: "(713) 555-0100",
      fatherGuardianName: "Robert Sample",
      maritalStatus: "Married",
      dateOfMarriage: "2015-06-01",
      child1NameAge: "Anna, 8",
      churchAffiliation: "IPC",
      localChurchNameAddress: "IPC Hebron Houston",
      localChurchAddressLine: "14000 Westheimer Rd",
      localChurchCity: "Houston",
      localChurchState: "TX",
      localChurchZip: "77077",
      localChurchPhone: "(713) 555-0148",
      receivedJesusWhen: "2005",
      waterBaptismWhen: "2006",
      filledWithHolySpirit: "Yes",
      definiteCallForService: "Yes — pastoral ministry",
      ordainedPastor: "No",
      sinceHighSchool: "College and teaching work",
      christianMinistryDetails: "Youth ministry volunteer",
      awardsReceived: "None",
      highSchoolInstitution: "Central High, Houston",
      highSchoolCompletionDate: "2008",
      highSchoolDiplomaDegree: "Diploma",
      highSchoolClassDivision: "First",
      highSchoolPassedFailed: "Passed",
      whyJoinProgramme: "To prepare for Christian service.",
      discontinuedStudies: "No",
      healthConditions: ["allergies", "frequent_headaches"],
      illnessHistory: "Seasonal allergies",
      illnessStatusNow: "Managed",
      refPastorName: "Rev. Example",
      refPastorAddress: "100 Church St",
      refPastorCity: "Houston",
      refPastorState: "TX",
      refPastorZip: "77001",
      refPastorPhone: "(713) 555-0111",
      refOfficialName: "Elder Example",
      refOfficialAddress: "200 Ministry Ave",
      refOfficialCity: "Houston",
      refOfficialState: "TX",
      refOfficialZip: "77002",
      refOfficialPhone: "(713) 555-0112",
      refFriendName: "Friend Example",
      refFriendAddress: "300 Friend Ln",
      refFriendCity: "Houston",
      refFriendState: "TX",
      refFriendZip: "77003",
      refFriendPhone: "(713) 555-0113",
      declarationName: "JOHN SAMPLE APPLICANT",
      applicantSignatureDate: "2026-08-13",
      applicantSignature: "John Sample Applicant",
      declarationAccepted: true,
    },
    registrarResponses: {
      registrarDateReceived: "2026-08-14",
      registrarFeesReceived: "50",
      registrarApplicationNumber: "HTC-2026-001",
      registrarAdmissionDecision: "Approved",
      registrarDecisionDate: "2026-08-20",
      registrarSignature: "Registrar Name",
    },
  });

  const outDir = path.join(process.cwd(), "tmp");
  await mkdir(outDir, { recursive: true });
  const out = path.join(outDir, "htc-application-smoke.pdf");
  await writeFile(out, buf);
  console.log(`Wrote ${out} (${buf.length} bytes)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
