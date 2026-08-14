import { readFile } from "fs/promises";
import path from "path";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { loadEmbeddedPhotoBytes } from "@/lib/embedded-photo-storage";
import { responseToDisplayString } from "@/lib/embedded-form-validate";

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
    if (photoBytes) {
      try {
        const img = await pdf.embedJpg(photoBytes);
        p.drawImage(img, { x: 458, y: 548, width: 108, height: 136 });
      } catch {
        try {
          const img = await pdf.embedPng(photoBytes);
          p.drawImage(img, { x: 458, y: 548, width: 108, height: 136 });
        } catch {
          /* skip photo */
        }
      }
    }

    drawText(p, font, str(r, "fullName").toUpperCase(), { x: 58, y: 508, size: 11, maxWidth: 380 });

    if (str(r, "sex") === "Male") mark(p, 78, 470);
    if (str(r, "sex") === "Female") mark(p, 148, 470);

    drawText(p, font, str(r, "dobDay"), { x: 58, y: 422, size: 10, maxWidth: 70 });
    drawText(p, font, str(r, "dobMonth"), { x: 148, y: 422, size: 10, maxWidth: 90 });
    drawText(p, font, str(r, "dobYear"), { x: 268, y: 422, size: 10, maxWidth: 90 });
    drawText(p, font, str(r, "ageNow"), { x: 400, y: 422, size: 10, maxWidth: 70 });

    drawText(p, font, str(r, "nationality"), { x: 58, y: 372, size: 10, maxWidth: 150 });
    drawText(p, font, str(r, "state"), { x: 230, y: 372, size: 10, maxWidth: 150 });
    drawText(p, font, str(r, "county"), { x: 400, y: 372, size: 10, maxWidth: 150 });

    drawText(p, font, str(r, "occupation"), { x: 58, y: 322, size: 10, maxWidth: 230 });
    drawText(p, font, str(r, "motherTongue"), { x: 320, y: 322, size: 10, maxWidth: 230 });

    drawText(p, font, str(r, "otherLanguages"), { x: 58, y: 272, size: 10, maxWidth: 500 });
    drawText(p, font, str(r, "addressLine1"), { x: 58, y: 222, size: 10, maxWidth: 500 });
    drawText(p, font, str(r, "addressLine2"), { x: 58, y: 178, size: 10, maxWidth: 500 });
  }

  // ——— Page 2: contact + family + church ———
  if (pages[1]) {
    const p = pages[1];
    drawText(p, font, str(r, "email"), { x: 58, y: 720, size: 10, maxWidth: 260 });
    drawText(p, font, str(r, "phone"), { x: 340, y: 720, size: 10, maxWidth: 200 });

    drawText(p, font, str(r, "fatherGuardianName"), { x: 58, y: 660, size: 10, maxWidth: 500 });
    drawText(p, font, str(r, "fatherGuardianAddress"), { x: 58, y: 610, size: 10, maxWidth: 500 });
    drawText(p, font, str(r, "fatherGuardianOccupation"), { x: 58, y: 560, size: 10, maxWidth: 500 });

    if (str(r, "maritalStatus") === "Married") mark(p, 78, 512);
    if (str(r, "maritalStatus") === "Unmarried") mark(p, 168, 512);
    drawText(p, font, str(r, "dateOfMarriage"), { x: 340, y: 512, size: 10, maxWidth: 200 });
    drawText(p, font, str(r, "spouseName"), { x: 58, y: 478, size: 10, maxWidth: 500 });

    drawText(p, font, str(r, "child1NameAge"), { x: 58, y: 438, size: 9, maxWidth: 160 });
    drawText(p, font, str(r, "child2NameAge"), { x: 230, y: 438, size: 9, maxWidth: 160 });
    drawText(p, font, str(r, "child3NameAge"), { x: 400, y: 438, size: 9, maxWidth: 160 });

    drawText(p, font, str(r, "churchAffiliation"), { x: 58, y: 380, size: 10, maxWidth: 500 });
    drawText(p, font, str(r, "localChurchNameAddress"), { x: 58, y: 330, size: 10, maxWidth: 500 });
    drawText(p, font, str(r, "localChurchPhone"), { x: 58, y: 288, size: 10, maxWidth: 220 });

    drawText(p, font, str(r, "receivedJesusWhen"), { x: 58, y: 240, size: 10, maxWidth: 500 });
    drawText(p, font, str(r, "waterBaptismWhen"), { x: 58, y: 192, size: 10, maxWidth: 500 });
    drawText(p, font, str(r, "filledWithHolySpirit"), { x: 58, y: 144, size: 9, maxWidth: 500 });
    drawText(p, font, str(r, "definiteCallForService"), { x: 58, y: 96, size: 9, maxWidth: 500 });
  }

  // ——— Page 3: ministry + education + motivation ———
  if (pages[2]) {
    const p = pages[2];
    if (str(r, "ordainedPastor") === "Yes") mark(p, 210, 720);
    if (str(r, "ordainedPastor") === "No") mark(p, 268, 720);
    drawText(p, font, str(r, "ordinationDetails"), { x: 58, y: 678, size: 9, maxWidth: 500 });
    drawText(p, font, str(r, "sinceHighSchool"), { x: 58, y: 620, size: 9, maxWidth: 500 });
    drawText(p, font, str(r, "christianMinistryDetails"), { x: 58, y: 560, size: 9, maxWidth: 500 });
    drawText(p, font, str(r, "awardsReceived"), { x: 58, y: 500, size: 9, maxWidth: 500 });

    // Education table rows — prefer dynamic educationEntries; fall back to legacy keys
    const eduY: Record<string, number> = {
      "High School": 390,
      Undergrad: 360,
      "Graduate School": 330,
      "Other, if any": 300,
    };
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
      drawText(p, font, institution, { x: 118, y, size: 8, maxWidth: 150 });
      drawText(p, font, completionDate, { x: 280, y, size: 8, maxWidth: 70 });
      drawText(p, font, diplomaDegree, { x: 360, y, size: 8, maxWidth: 70 });
      drawText(p, font, classDivision, { x: 440, y, size: 8, maxWidth: 55 });
      drawText(p, font, passedFailed, { x: 510, y, size: 8, maxWidth: 55 });
    }

    drawText(p, font, str(r, "whyJoinProgramme"), { x: 58, y: 220, size: 9, maxWidth: 500 });
    drawText(p, font, str(r, "discontinuedStudies"), { x: 58, y: 140, size: 9, maxWidth: 500 });
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
    const startY = 668;
    const rowH = 22;
    for (let i = 0; i < 8; i++) {
      const y = startY - i * rowH;
      if (hasCondition(r, col1[i]!)) mark(p, 52, y);
      if (hasCondition(r, col2[i]!)) mark(p, 230, y);
      if (hasCondition(r, col3[i]!)) mark(p, 408, y);
    }

    drawText(p, font, str(r, "illnessHistory"), { x: 58, y: 460, size: 9, maxWidth: 240 });
    drawText(p, font, str(r, "illnessStatusNow"), { x: 320, y: 460, size: 9, maxWidth: 240 });

    drawText(p, font, str(r, "refPastorName"), { x: 58, y: 370, size: 10, maxWidth: 500 });
    drawText(p, font, str(r, "refPastorAddress"), { x: 58, y: 338, size: 9, maxWidth: 320 });
    drawText(p, font, str(r, "refPastorPhone"), { x: 400, y: 338, size: 9, maxWidth: 150 });

    drawText(p, font, str(r, "refOfficialName"), { x: 58, y: 268, size: 10, maxWidth: 500 });
    drawText(p, font, str(r, "refOfficialAddress"), { x: 58, y: 236, size: 9, maxWidth: 320 });
    drawText(p, font, str(r, "refOfficialPhone"), { x: 400, y: 236, size: 9, maxWidth: 150 });

    drawText(p, font, str(r, "refFriendName"), { x: 58, y: 166, size: 10, maxWidth: 500 });
    drawText(p, font, str(r, "refFriendAddress"), { x: 58, y: 134, size: 9, maxWidth: 320 });
    drawText(p, font, str(r, "refFriendPhone"), { x: 400, y: 134, size: 9, maxWidth: 150 });
  }

  // ——— Page 5: declaration + registrar ———
  if (pages[4]) {
    const p = pages[4];
    const declName = str(r, "declarationName") || input.applicantFullName;
    drawText(p, font, declName, { x: 100, y: 700, size: 11, maxWidth: 420 });

    drawText(p, font, str(r, "applicantSignatureDate"), { x: 58, y: 488, size: 10, maxWidth: 160 });
    drawText(
      p,
      italic,
      input.signatureTypedName?.trim() || str(r, "applicantSignature") || declName,
      { x: 260, y: 488, size: 12, maxWidth: 280 },
    );

    const received = str(admin, "registrarDateReceived");
    const fees = str(admin, "registrarFeesReceived");
    const appNo = str(admin, "registrarApplicationNumber") || input.applicationNumber;
    const decision = str(admin, "registrarAdmissionDecision");
    const decisionDate = str(admin, "registrarDecisionDate");
    const registrarSig = str(admin, "registrarSignature");

    drawText(p, font, received, { x: 58, y: 330, size: 10, maxWidth: 200 });
    drawText(p, font, fees, { x: 320, y: 330, size: 10, maxWidth: 220 });
    drawText(p, font, appNo, { x: 58, y: 275, size: 10, maxWidth: 220 });

    if (decision === "Approved") mark(p, 360, 275);
    if (decision === "Rejected") mark(p, 440, 275);
    if (decision === "Referred") mark(p, 520, 275);

    drawText(p, font, decisionDate, { x: 58, y: 210, size: 10, maxWidth: 180 });
    drawText(p, italic, registrarSig, { x: 280, y: 210, size: 11, maxWidth: 260 });
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
