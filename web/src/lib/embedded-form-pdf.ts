import { readFile } from "fs/promises";
import path from "path";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { loadEmbeddedPhotoBytes } from "@/lib/embedded-photo-storage";
import { responseToDisplayString } from "@/lib/embedded-form-validate";
import { HTC_OVERLAY } from "@/lib/embedded-form-htc-pdf-layout";

type Pt = { x: number; y: number; size?: number; maxWidth?: number };

function pdfSafe(text: string): string {
  return text
    .replace(/[\u2018\u2019\u201A\u2032]/g, "'")
    .replace(/[\u201C\u201D\u201E\u2033]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u00A0/g, " ")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "?");
}

function wrapToWidth(font: PDFFont, text: string, size: number, maxWidth: number): string[] {
  const words = pdfSafe(text).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(next, size) > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawText(page: PDFPage, font: PDFFont, text: string, opts: Pt & { color?: ReturnType<typeof rgb> }) {
  const size = opts.size ?? 9;
  const color = opts.color ?? rgb(0.1, 0.1, 0.14);
  const maxWidth = opts.maxWidth ?? 520;
  const lines = wrapToWidth(font, text, size, maxWidth);
  let y = opts.y;
  for (const line of lines.slice(0, 6)) {
    page.drawText(line, { x: opts.x, y, size, font, color });
    y -= size + 2;
  }
}

function mark(page: PDFPage, x: number, y: number) {
  page.drawText("X", {
    x,
    y,
    size: 10,
    color: rgb(0.15, 0.2, 0.55),
  });
}

function str(responses: Record<string, unknown>, key: string): string {
  return responseToDisplayString(responses[key]).trim();
}

function hasCondition(responses: Record<string, unknown>, value: string): boolean {
  const raw = responses.healthConditions;
  if (Array.isArray(raw)) return raw.map(String).includes(value);
  if (typeof raw === "string") return raw.split(",").map((s) => s.trim()).includes(value);
  return false;
}

async function loadTemplateBytes(templateKey: string): Promise<Uint8Array> {
  const safe = templateKey.replace(/[^a-zA-Z0-9_-]/g, "") || "htc-application";
  const abs = path.join(/* turbopackIgnore: true */ process.cwd(), "assets", "embedded-forms", `${safe}.pdf`);
  return new Uint8Array(await readFile(abs));
}

export type EmbeddedPdfRenderInput = {
  templateKey: string;
  applicationNumber: string;
  responses: Record<string, unknown>;
  registrarResponses?: Record<string, unknown> | null;
  photoObjectKey?: string | null;
  signatureTypedName?: string | null;
  applicantFullName: string;
};

/**
 * Overlay applicant + registrar answers onto the blank multi-page template PDF.
 * Coordinates are tuned for Letter (612×792) HTC application pages.
 */
export async function renderEmbeddedApplicationPdf(
  input: EmbeddedPdfRenderInput,
): Promise<Buffer> {
  const templateBytes = await loadTemplateBytes(input.templateKey || "htc-application");
  const pdf = await PDFDocument.load(templateBytes);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const italic = await pdf.embedFont(StandardFonts.HelveticaOblique);
  const pages = pdf.getPages();
  const r = input.responses;
  const admin = (input.registrarResponses ?? {}) as Record<string, unknown>;

  // ——— Page 1: Personal Information + photo ———
  if (pages[0]) {
    const p = pages[0];
    const photoBytes = await loadEmbeddedPhotoBytes(input.photoObjectKey);
    const photoBox = HTC_OVERLAY.page1.photo;
    if (photoBytes) {
      try {
        const img = await pdf.embedJpg(photoBytes);
        p.drawImage(img, photoBox);
      } catch {
        try {
          const img = await pdf.embedPng(photoBytes);
          p.drawImage(img, photoBox);
        } catch {
          /* skip photo */
        }
      }
    }

    const p1 = HTC_OVERLAY.page1;
    drawText(p, font, str(r, "fullName").toUpperCase(), p1.fullName);

    if (str(r, "sex") === "Male") mark(p, p1.sexMale.x, p1.sexMale.y);
    if (str(r, "sex") === "Female") mark(p, p1.sexFemale.x, p1.sexFemale.y);

    drawText(p, font, str(r, "dobMonth"), p1.dobMonth);
    drawText(p, font, str(r, "dobDay"), p1.dobDay);
    drawText(p, font, str(r, "dobYear"), p1.dobYear);
    drawText(p, font, str(r, "ageNow"), p1.ageNow);

    drawText(p, font, str(r, "nationality"), p1.nationality);
    drawText(p, font, str(r, "state"), p1.state);
    drawText(p, font, str(r, "county"), p1.county);

    drawText(p, font, str(r, "occupation"), p1.occupation);
    drawText(p, font, str(r, "primaryLanguage") || str(r, "motherTongue"), p1.primaryLanguage);

    drawText(p, font, str(r, "otherLanguages"), p1.otherLanguages);
    drawText(p, font, str(r, "addressLine1"), p1.addressLine1);
    drawText(p, font, str(r, "addressLine2"), p1.addressLine2);
  }

  // ——— Page 2: contact + family + church ———
  if (pages[1]) {
    const p = pages[1];
    const p2 = HTC_OVERLAY.page2;
    drawText(p, font, str(r, "email"), p2.email);
    drawText(p, font, str(r, "phone"), p2.phone);

    drawText(p, font, str(r, "fatherGuardianName"), p2.fatherGuardianName);

    if (str(r, "maritalStatus") === "Married") mark(p, p2.maritalMarried.x, p2.maritalMarried.y);
    if (str(r, "maritalStatus") === "Unmarried") mark(p, p2.maritalUnmarried.x, p2.maritalUnmarried.y);
    drawText(p, font, str(r, "dateOfMarriage"), p2.dateOfMarriage);
    drawText(p, font, str(r, "spouseName"), p2.spouseName);

    drawText(p, font, str(r, "child1NameAge"), p2.child1);
    drawText(p, font, str(r, "child2NameAge"), p2.child2);
    drawText(p, font, str(r, "child3NameAge"), p2.child3);

    drawText(p, font, str(r, "churchAffiliation"), p2.churchAffiliation);
    drawText(p, font, str(r, "localChurchNameAddress"), p2.localChurchNameAddress);
    drawText(p, font, str(r, "localChurchPhone"), p2.localChurchPhone);

    drawText(p, font, str(r, "receivedJesusWhen"), p2.receivedJesusWhen);
    drawText(p, font, str(r, "waterBaptismWhen"), p2.waterBaptismWhen);
    drawText(p, font, str(r, "filledWithHolySpirit"), p2.filledWithHolySpirit);
    drawText(p, font, str(r, "definiteCallForService"), p2.definiteCallForService);
    if (str(r, "ordainedPastor") === "Yes") mark(p, p2.ordainedYes.x, p2.ordainedYes.y);
    if (str(r, "ordainedPastor") === "No") mark(p, p2.ordainedNo.x, p2.ordainedNo.y);
  }

  // ——— Page 3: ministry + education + motivation ———
  if (pages[2]) {
    const p = pages[2];
    const p3 = HTC_OVERLAY.page3;
    drawText(p, font, str(r, "ordinationDetails"), p3.ordinationDetails);
    drawText(p, font, str(r, "sinceHighSchool"), p3.sinceHighSchool);
    drawText(p, font, str(r, "christianMinistryDetails"), p3.christianMinistryDetails);
    drawText(p, font, str(r, "awardsReceived"), p3.awardsReceived);

    // Education table rows — prefer dynamic educationEntries; fall back to legacy keys
    const eduY: Record<string, number> = { ...p3.educationRows };
    const legacyPrefix: Record<string, string> = {
      "High School": "highSchool",
      Undergrad: "undergrad",
      "Graduate School": "graduate",
      "Other, if any": "otherEdu",
    };
    const entries = Array.isArray(r.educationEntries)
      ? (r.educationEntries as Array<Record<string, unknown>>)
      : [];
    for (const [label, y] of Object.entries(eduY)) {
      const fromEntries = entries.find((e) => String(e.description ?? "") === label);
      const prefix = legacyPrefix[label]!;
      const institution = fromEntries
        ? String(fromEntries.institution ?? "")
        : str(r, `${prefix}Institution`);
      const completionDate = fromEntries
        ? String(fromEntries.completionDate ?? "")
        : str(r, `${prefix}CompletionDate`);
      const diplomaDegree = fromEntries
        ? String(fromEntries.diplomaDegree ?? "")
        : str(r, `${prefix}DiplomaDegree`);
      const classDivision = fromEntries
        ? String(fromEntries.classDivision ?? "")
        : str(r, `${prefix}ClassDivision`);
      const passedFailed = fromEntries
        ? String(fromEntries.passedFailed ?? "")
        : str(r, `${prefix}PassedFailed`);
      const cols = p3.educationCols;
      drawText(p, font, institution, { x: cols.institution, y, size: 8, maxWidth: 150 });
      drawText(p, font, completionDate, { x: cols.completionDate, y, size: 8, maxWidth: 70 });
      drawText(p, font, diplomaDegree, { x: cols.diplomaDegree, y, size: 8, maxWidth: 70 });
      drawText(p, font, classDivision, { x: cols.classDivision, y, size: 8, maxWidth: 55 });
      drawText(p, font, passedFailed, { x: cols.passedFailed, y, size: 8, maxWidth: 55 });
    }

    drawText(p, font, str(r, "whyJoinProgramme"), p3.whyJoinProgramme);
    drawText(p, font, str(r, "discontinuedStudies"), p3.discontinuedStudies);
  }

  // ——— Page 4: health + references ———
  if (pages[3]) {
    const p = pages[3];
    // 3-column checkbox grid — values match template order
    const col1 = [
      "poor_vision",
      "noises_in_ears",
      "nose_bleeding",
      "allergies",
      "chest_pain",
      "skin_diseases",
      "diarrhoea",
      "mental_depression",
    ];
    const col2 = [
      "eye_strain",
      "frequent_headaches",
      "gum_bleeding",
      "shortness_of_breath",
      "bronchitis",
      "food_intolerance",
      "frequent_constipation",
      "sleep_trouble",
    ];
    const col3 = [
      "poor_hearing",
      "frequent_cold",
      "sinus_trouble",
      "asthma",
      "heart_palpitations",
      "stomach_pains",
      "muscle_or_bone_pain",
      "frequent_urination",
    ];
    const p4 = HTC_OVERLAY.page4;
    const startY = p4.checkboxStartY;
    const rowH = p4.checkboxRowH;
    for (let i = 0; i < 8; i++) {
      const y = startY - i * rowH;
      if (hasCondition(r, col1[i]!)) mark(p, p4.checkboxColX[0], y);
      if (hasCondition(r, col2[i]!)) mark(p, p4.checkboxColX[1], y);
      if (hasCondition(r, col3[i]!)) mark(p, p4.checkboxColX[2], y);
    }

    drawText(p, font, str(r, "illnessHistory"), p4.illnessHistory);
    drawText(p, font, str(r, "illnessStatusNow"), p4.illnessStatusNow);

    drawText(p, font, str(r, "refPastorName"), p4.refPastorName);
    drawText(p, font, str(r, "refPastorAddress"), p4.refPastorAddress);
    drawText(p, font, str(r, "refPastorPhone"), p4.refPastorPhone);

    drawText(p, font, str(r, "refOfficialName"), p4.refOfficialName);
    drawText(p, font, str(r, "refOfficialAddress"), p4.refOfficialAddress);
    drawText(p, font, str(r, "refOfficialPhone"), p4.refOfficialPhone);

    drawText(p, font, str(r, "refFriendName"), p4.refFriendName);
    drawText(p, font, str(r, "refFriendAddress"), p4.refFriendAddress);
    drawText(p, font, str(r, "refFriendPhone"), p4.refFriendPhone);
  }

  // ——— Page 5: declaration + registrar ———
  if (pages[4]) {
    const p = pages[4];
    const p5 = HTC_OVERLAY.page5;
    const declName = str(r, "declarationName") || input.applicantFullName;
    drawText(p, font, declName, p5.declarationName);

    drawText(p, font, str(r, "applicantSignatureDate"), p5.applicantSignatureDate);
    drawText(
      p,
      italic,
      input.signatureTypedName?.trim() || str(r, "applicantSignature") || declName,
      p5.applicantSignature,
    );

    const received = str(admin, "registrarDateReceived");
    const fees = str(admin, "registrarFeesReceived");
    const appNo = str(admin, "registrarApplicationNumber") || input.applicationNumber;
    const decision = str(admin, "registrarAdmissionDecision");
    const decisionDate = str(admin, "registrarDecisionDate");
    const registrarSig = str(admin, "registrarSignature");

    drawText(p, font, received, p5.registrarDateReceived);
    drawText(p, font, fees, p5.registrarFeesReceived);
    drawText(p, font, appNo, p5.registrarApplicationNumber);

    if (decision === "Approved") mark(p, p5.decisionApproved.x, p5.decisionApproved.y);
    if (decision === "Rejected") mark(p, p5.decisionRejected.x, p5.decisionRejected.y);
    if (decision === "Referred") mark(p, p5.decisionReferred.x, p5.decisionReferred.y);

    drawText(p, font, decisionDate, p5.registrarDecisionDate);
    drawText(p, italic, registrarSig, p5.registrarSignature);
  }

  // Page 6 remains instructions-only (no overlays).

  const bytes = await pdf.save();
  return Buffer.from(bytes);
}

export function embeddedPdfFilename(fullName: string, applicationNumber: string): string {
  const raw = fullName.trim() || "applicant";
  let base = raw.replace(/[^a-zA-Z0-9.-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  if (base.length < 2) base = "applicant";
  const num = applicationNumber.replace(/[^a-zA-Z0-9-]+/g, "");
  return `application-${num || "export"}-${base}.pdf`;
}
