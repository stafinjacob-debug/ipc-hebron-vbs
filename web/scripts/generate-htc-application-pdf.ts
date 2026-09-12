/**
 * Regenerates the blank HTC application PDF to match the current printed form.
 * Run from web/: npx tsx scripts/generate-htc-application-pdf.ts
 */
import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { HTC_OVERLAY, HTC_PAGE } from "../src/lib/embedded-form-htc-pdf-layout";

const ACCENT = rgb(0.22, 0.27, 0.84);
const INK = rgb(0.09, 0.1, 0.14);
const MUTED = rgb(0.42, 0.44, 0.5);
const LINE = rgb(0.78, 0.8, 0.84);
const RULE = rgb(0.88, 0.89, 0.92);

function caption(page: PDFPage, font: PDFFont, text: string, x: number, y: number, size = 7) {
  page.drawText(text.toUpperCase(), { x, y, size, font, color: MUTED });
}

function numberLabel(page: PDFPage, bold: PDFFont, n: string, x: number, y: number) {
  page.drawText(n, { x, y, size: 10, font: bold, color: ACCENT });
}

function writeLine(page: PDFPage, x: number, y: number, width: number) {
  page.drawLine({
    start: { x, y },
    end: { x: x + width, y },
    thickness: 0.7,
    color: LINE,
  });
}

function sectionTitle(page: PDFPage, bold: PDFFont, title: string, y: number) {
  page.drawText(title, { x: 48, y, size: 13, font: bold, color: INK });
  page.drawLine({
    start: { x: 48, y: y - 8 },
    end: { x: 564, y: y - 8 },
    thickness: 0.6,
    color: RULE,
  });
}

async function drawHeader(page: PDFPage, fonts: Fonts, logoBytes: Uint8Array | null, pdf: PDFDocument) {
  page.drawLine({
    start: { x: 0, y: 786 },
    end: { x: 612, y: 786 },
    thickness: 4,
    color: ACCENT,
  });

  if (logoBytes) {
    try {
      const img = await pdf.embedPng(logoBytes);
      page.drawImage(img, { x: 48, y: 736, width: 28, height: 36 });
    } catch {
      /* skip */
    }
  }
  page.drawText("HEBRON", { x: 84, y: 758, size: 9, font: fonts.bold, color: INK });
  page.drawText("THEOLOGICAL COLLEGE", { x: 84, y: 746, size: 8, font: fonts.regular, color: INK });

  const right = [
    "HEBRON THEOLOGICAL COLLEGE",
    "IPC Hebron Houston · Houston, TX",
    "admissions@ipchouston.com",
    "ipchouston.com",
  ];
  let ry = 762;
  for (const line of right) {
    const w = fonts.regular.widthOfTextAtSize(line, 8);
    page.drawText(line, { x: 564 - w, y: ry, size: 8, font: fonts.regular, color: MUTED });
    ry -= 11;
  }
}

type Fonts = { regular: PDFFont; bold: PDFFont };

async function buildPdf(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const fonts = { regular, bold };

  let logoBytes: Uint8Array | null = null;
  try {
    logoBytes = new Uint8Array(
      await readFile(path.join(process.cwd(), "public", "htc-flame-logo.png")),
    );
  } catch {
    logoBytes = null;
  }

  // ——— Page 1 ———
  {
    const p = pdf.addPage([HTC_PAGE.width, HTC_PAGE.height]);
    await drawHeader(p, fonts, logoBytes, pdf);
    p.drawText("Application for Admission", { x: 48, y: 708, size: 22, font: bold, color: INK });
    p.drawText("Bachelor of Theology", { x: 48, y: 688, size: 11, font: regular, color: MUTED });

    const photo = HTC_OVERLAY.page1.photo;
    p.drawRectangle({
      x: photo.x,
      y: photo.y,
      width: photo.width,
      height: photo.height,
      borderColor: LINE,
      borderWidth: 1,
      borderDashArray: [3, 2],
    });
    caption(p, regular, "Passport photo", photo.x + 16, photo.y + 64, 8);
    caption(p, regular, "Recent passport photo", photo.x + 4, photo.y - 12, 6.5);

    sectionTitle(p, bold, "Personal Information", 548);

    numberLabel(p, bold, "1", 48, HTC_OVERLAY.page1.fullName.y + 16);
    writeLine(p, 58, HTC_OVERLAY.page1.fullName.y - 4, 380);
    caption(p, regular, "Full name (block letters) — exactly as it appears on your academic certificate", 58, HTC_OVERLAY.page1.fullName.y - 16);

    numberLabel(p, bold, "2", 48, HTC_OVERLAY.page1.sexMale.y + 4);
    p.drawCircle({ x: HTC_OVERLAY.page1.sexMale.x + 4, y: HTC_OVERLAY.page1.sexMale.y + 4, size: 5, borderColor: LINE, borderWidth: 1 });
    p.drawText("Male", { x: HTC_OVERLAY.page1.sexMale.x + 14, y: HTC_OVERLAY.page1.sexMale.y, size: 10, font: regular, color: INK });
    p.drawCircle({ x: HTC_OVERLAY.page1.sexFemale.x + 4, y: HTC_OVERLAY.page1.sexFemale.y + 4, size: 5, borderColor: LINE, borderWidth: 1 });
    p.drawText("Female", { x: HTC_OVERLAY.page1.sexFemale.x + 14, y: HTC_OVERLAY.page1.sexFemale.y, size: 10, font: regular, color: INK });
    caption(p, regular, "Sex", 58, HTC_OVERLAY.page1.sexMale.y - 16);

    numberLabel(p, bold, "3", 48, HTC_OVERLAY.page1.dobMonth.y + 16);
    writeLine(p, 58, HTC_OVERLAY.page1.dobMonth.y - 4, 90);
    writeLine(p, 168, HTC_OVERLAY.page1.dobDay.y - 4, 80);
    writeLine(p, 278, HTC_OVERLAY.page1.dobYear.y - 4, 90);
    writeLine(p, 400, HTC_OVERLAY.page1.ageNow.y - 4, 70);
    caption(p, regular, "Month", 58, HTC_OVERLAY.page1.dobMonth.y - 16);
    caption(p, regular, "Day", 168, HTC_OVERLAY.page1.dobDay.y - 16);
    caption(p, regular, "Year", 278, HTC_OVERLAY.page1.dobYear.y - 16);
    caption(p, regular, "Age", 400, HTC_OVERLAY.page1.ageNow.y - 16);

    numberLabel(p, bold, "4", 48, HTC_OVERLAY.page1.nationality.y + 16);
    writeLine(p, 58, HTC_OVERLAY.page1.nationality.y - 4, 150);
    writeLine(p, 230, HTC_OVERLAY.page1.state.y - 4, 150);
    writeLine(p, 400, HTC_OVERLAY.page1.county.y - 4, 150);
    caption(p, regular, "Nationality", 58, HTC_OVERLAY.page1.nationality.y - 16);
    caption(p, regular, "State", 230, HTC_OVERLAY.page1.state.y - 16);
    caption(p, regular, "Country", 400, HTC_OVERLAY.page1.county.y - 16);

    numberLabel(p, bold, "5", 48, HTC_OVERLAY.page1.occupation.y + 16);
    writeLine(p, 58, HTC_OVERLAY.page1.occupation.y - 4, 230);
    writeLine(p, 320, HTC_OVERLAY.page1.primaryLanguage.y - 4, 230);
    caption(p, regular, "Your occupation", 58, HTC_OVERLAY.page1.occupation.y - 16);
    caption(p, regular, "Primary language", 320, HTC_OVERLAY.page1.primaryLanguage.y - 16);

    numberLabel(p, bold, "6", 48, HTC_OVERLAY.page1.otherLanguages.y + 16);
    writeLine(p, 58, HTC_OVERLAY.page1.otherLanguages.y - 4, 500);
    caption(p, regular, "Other languages you can speak, read and write", 58, HTC_OVERLAY.page1.otherLanguages.y - 16);

    numberLabel(p, bold, "7", 48, HTC_OVERLAY.page1.addressLine1.y + 16);
    writeLine(p, 58, HTC_OVERLAY.page1.addressLine1.y - 4, 500);
    caption(p, regular, "Address line", 58, HTC_OVERLAY.page1.addressLine1.y - 16);
    writeLine(p, 58, HTC_OVERLAY.page1.addressLine2.y - 4, 500);
    caption(p, regular, "City, State, ZIP Code", 58, HTC_OVERLAY.page1.addressLine2.y - 16);
  }

  // ——— Page 2 ———
  {
    const p = pdf.addPage([HTC_PAGE.width, HTC_PAGE.height]);
    writeLine(p, 58, HTC_OVERLAY.page2.email.y - 4, 260);
    writeLine(p, 340, HTC_OVERLAY.page2.phone.y - 4, 200);
    caption(p, regular, "Email", 58, HTC_OVERLAY.page2.email.y - 16);
    caption(p, regular, "Phone", 340, HTC_OVERLAY.page2.phone.y - 16);

    numberLabel(p, bold, "8", 48, HTC_OVERLAY.page2.fatherGuardianName.y + 16);
    writeLine(p, 58, HTC_OVERLAY.page2.fatherGuardianName.y - 4, 500);
    caption(p, regular, "Name of father / guardian", 58, HTC_OVERLAY.page2.fatherGuardianName.y - 16);

    numberLabel(p, bold, "9", 48, HTC_OVERLAY.page2.maritalMarried.y + 4);
    p.drawCircle({ x: HTC_OVERLAY.page2.maritalMarried.x + 4, y: HTC_OVERLAY.page2.maritalMarried.y + 4, size: 5, borderColor: LINE, borderWidth: 1 });
    p.drawText("Married", { x: HTC_OVERLAY.page2.maritalMarried.x + 14, y: HTC_OVERLAY.page2.maritalMarried.y, size: 10, font: regular, color: INK });
    p.drawCircle({ x: HTC_OVERLAY.page2.maritalUnmarried.x + 4, y: HTC_OVERLAY.page2.maritalUnmarried.y + 4, size: 5, borderColor: LINE, borderWidth: 1 });
    p.drawText("Unmarried", { x: HTC_OVERLAY.page2.maritalUnmarried.x + 14, y: HTC_OVERLAY.page2.maritalUnmarried.y, size: 10, font: regular, color: INK });
    writeLine(p, 340, HTC_OVERLAY.page2.dateOfMarriage.y - 4, 200);
    caption(p, regular, "Marital status", 58, HTC_OVERLAY.page2.maritalMarried.y - 16);
    caption(p, regular, "Date of marriage (if applicable)", 340, HTC_OVERLAY.page2.dateOfMarriage.y - 16);

    numberLabel(p, bold, "10", 48, HTC_OVERLAY.page2.spouseName.y + 16);
    writeLine(p, 58, HTC_OVERLAY.page2.spouseName.y - 4, 500);
    caption(p, regular, "Name of spouse", 58, HTC_OVERLAY.page2.spouseName.y - 16);

    numberLabel(p, bold, "11", 48, HTC_OVERLAY.page2.child1.y + 16);
    writeLine(p, 58, HTC_OVERLAY.page2.child1.y - 4, 160);
    writeLine(p, 230, HTC_OVERLAY.page2.child2.y - 4, 160);
    writeLine(p, 400, HTC_OVERLAY.page2.child3.y - 4, 160);
    caption(p, regular, "Child (I) — name & age", 58, HTC_OVERLAY.page2.child1.y - 16);
    caption(p, regular, "Child (II) — name & age", 230, HTC_OVERLAY.page2.child2.y - 16);
    caption(p, regular, "Child (III) — name & age", 400, HTC_OVERLAY.page2.child3.y - 16);

    sectionTitle(p, bold, "Church & Spiritual Background", 468);

    numberLabel(p, bold, "12", 48, HTC_OVERLAY.page2.churchAffiliation.y + 16);
    writeLine(p, 58, HTC_OVERLAY.page2.churchAffiliation.y - 4, 500);
    caption(p, regular, "Your church affiliation (denomination)", 58, HTC_OVERLAY.page2.churchAffiliation.y - 16);

    numberLabel(p, bold, "13", 48, HTC_OVERLAY.page2.localChurchNameAddress.y + 16);
    writeLine(p, 58, HTC_OVERLAY.page2.localChurchNameAddress.y - 4, 500);
    caption(p, regular, "Name and address of your local church (street, city, state, ZIP)", 58, HTC_OVERLAY.page2.localChurchNameAddress.y - 16);
    writeLine(p, 340, HTC_OVERLAY.page2.localChurchPhone.y - 4, 200);
    caption(p, regular, "Phone", 340, HTC_OVERLAY.page2.localChurchPhone.y - 16);

    numberLabel(p, bold, "14", 48, HTC_OVERLAY.page2.receivedJesusWhen.y + 16);
    writeLine(p, 58, HTC_OVERLAY.page2.receivedJesusWhen.y - 4, 500);
    caption(p, regular, "When did you receive Jesus Christ as your personal Saviour?", 58, HTC_OVERLAY.page2.receivedJesusWhen.y - 16);

    numberLabel(p, bold, "15", 48, HTC_OVERLAY.page2.waterBaptismWhen.y + 16);
    writeLine(p, 58, HTC_OVERLAY.page2.waterBaptismWhen.y - 4, 500);
    caption(p, regular, "When did you receive water baptism?", 58, HTC_OVERLAY.page2.waterBaptismWhen.y - 16);

    numberLabel(p, bold, "16", 48, HTC_OVERLAY.page2.filledWithHolySpirit.y + 16);
    writeLine(p, 58, HTC_OVERLAY.page2.filledWithHolySpirit.y - 4, 500);
    caption(p, regular, "Are you filled with the Holy Spirit? (Acts 2:4)", 58, HTC_OVERLAY.page2.filledWithHolySpirit.y - 16);

    numberLabel(p, bold, "17", 48, HTC_OVERLAY.page2.definiteCallForService.y + 16);
    writeLine(p, 58, HTC_OVERLAY.page2.definiteCallForService.y - 4, 500);
    caption(p, regular, "Do you have a definite call for Christian service?", 58, HTC_OVERLAY.page2.definiteCallForService.y - 16);

    numberLabel(p, bold, "18", 48, HTC_OVERLAY.page2.ordainedYes.y + 4);
    p.drawText("Are you an ordained pastor?", {
      x: 68,
      y: HTC_OVERLAY.page2.ordainedYes.y,
      size: 10,
      font: regular,
      color: INK,
    });
    p.drawCircle({ x: HTC_OVERLAY.page2.ordainedYes.x + 4, y: HTC_OVERLAY.page2.ordainedYes.y + 4, size: 5, borderColor: LINE, borderWidth: 1 });
    p.drawText("Yes", { x: HTC_OVERLAY.page2.ordainedYes.x + 14, y: HTC_OVERLAY.page2.ordainedYes.y, size: 10, font: regular, color: INK });
    p.drawCircle({ x: HTC_OVERLAY.page2.ordainedNo.x + 4, y: HTC_OVERLAY.page2.ordainedNo.y + 4, size: 5, borderColor: LINE, borderWidth: 1 });
    p.drawText("No", { x: HTC_OVERLAY.page2.ordainedNo.x + 14, y: HTC_OVERLAY.page2.ordainedNo.y, size: 10, font: regular, color: INK });
  }

  // ——— Page 3 ———
  {
    const p = pdf.addPage([HTC_PAGE.width, HTC_PAGE.height]);
    writeLine(p, 58, HTC_OVERLAY.page3.ordinationDetails.y - 4, 500);
    caption(
      p,
      regular,
      "If yes — date of ordination and the church where you minister",
      58,
      HTC_OVERLAY.page3.ordinationDetails.y - 16,
    );

    numberLabel(p, bold, "19", 48, HTC_OVERLAY.page3.sinceHighSchool.y + 16);
    writeLine(p, 58, HTC_OVERLAY.page3.sinceHighSchool.y - 4, 500);
    caption(p, regular, "What have you done since leaving high school? (work and study)", 58, HTC_OVERLAY.page3.sinceHighSchool.y - 16);

    numberLabel(p, bold, "20", 48, HTC_OVERLAY.page3.christianMinistryDetails.y + 16);
    writeLine(p, 58, HTC_OVERLAY.page3.christianMinistryDetails.y - 4, 500);
    caption(p, regular, "Are you involved in any Christian ministry? If so, give details", 58, HTC_OVERLAY.page3.christianMinistryDetails.y - 16);

    numberLabel(p, bold, "21", 48, HTC_OVERLAY.page3.awardsReceived.y + 16);
    writeLine(p, 58, HTC_OVERLAY.page3.awardsReceived.y - 4, 500);
    caption(
      p,
      regular,
      "Awards received in sports, games, music, artwork, literary or other activity",
      58,
      HTC_OVERLAY.page3.awardsReceived.y - 16,
    );

    sectionTitle(p, bold, "Educational Qualification", 478);
    numberLabel(p, bold, "22", 48, 456);
    p.drawText("All applicable columns must be filled", { x: 68, y: 456, size: 9, font: regular, color: MUTED });

    const headers = [
      { x: 48, t: "Description" },
      { x: 118, t: "Name & Place of Institution" },
      { x: 280, t: "Date of Completion" },
      { x: 360, t: "Diploma / Degree" },
      { x: 440, t: "Class / Division" },
      { x: 510, t: "Passed / Failed" },
    ];
    p.drawRectangle({ x: 48, y: 412, width: 516, height: 22, color: rgb(0.12, 0.12, 0.16) });
    for (const h of headers) {
      p.drawText(h.t, { x: h.x + 2, y: 419, size: 6.5, font: bold, color: rgb(1, 1, 1) });
    }
    const rows = [
      { y: HTC_OVERLAY.page3.educationRows["High School"]!, label: "High School" },
      { y: HTC_OVERLAY.page3.educationRows.Undergrad!, label: "Undergrad" },
      { y: HTC_OVERLAY.page3.educationRows["Graduate School"]!, label: "Graduate School" },
      { y: HTC_OVERLAY.page3.educationRows["Other, if any"]!, label: "Other, if any" },
    ];
    for (const row of rows) {
      p.drawRectangle({ x: 48, y: row.y - 8, width: 516, height: 26, borderColor: LINE, borderWidth: 0.6 });
      p.drawText(row.label, { x: 52, y: row.y, size: 7.5, font: regular, color: INK });
    }

    sectionTitle(p, bold, "Motivation & Background", 268);
    numberLabel(p, bold, "23", 48, HTC_OVERLAY.page3.whyJoinProgramme.y + 16);
    writeLine(p, 58, HTC_OVERLAY.page3.whyJoinProgramme.y - 4, 500);
    caption(p, regular, "Why would you like to join this programme?", 58, HTC_OVERLAY.page3.whyJoinProgramme.y - 16);

    numberLabel(p, bold, "24", 48, HTC_OVERLAY.page3.discontinuedStudies.y + 16);
    writeLine(p, 58, HTC_OVERLAY.page3.discontinuedStudies.y - 4, 500);
    caption(p, regular, "Have you ever discontinued any studies? If so, why?", 58, HTC_OVERLAY.page3.discontinuedStudies.y - 16);

    sectionTitle(p, bold, "Health Declaration", 88);
    numberLabel(p, bold, "25", 48, 66);
    p.drawText("Check any of the following you currently suffer from", {
      x: 68,
      y: 66,
      size: 9,
      font: regular,
      color: MUTED,
    });
  }

  // ——— Page 4 ———
  {
    const p = pdf.addPage([HTC_PAGE.width, HTC_PAGE.height]);
    const conditions = [
      ["Poor vision", "Eye strain", "Poor hearing"],
      ["Noises in ears", "Frequent headaches", "Frequent cold"],
      ["Nose bleeding", "Gum bleeding", "Sinus trouble"],
      ["Allergies", "Shortness of breath", "Asthma"],
      ["Chest pain", "Bronchitis", "Heart palpitations"],
      ["Skin diseases", "Food intolerance", "Stomach pains"],
      ["Diarrhoea", "Frequent constipation", "Muscle or bone pain"],
      ["Mental depression", "Sleep trouble", "Frequent urination"],
    ];
    const { checkboxStartY, checkboxRowH, checkboxColX } = HTC_OVERLAY.page4;
    for (let i = 0; i < conditions.length; i++) {
      const y = checkboxStartY - i * checkboxRowH;
      for (let c = 0; c < 3; c++) {
        const x = checkboxColX[c]!;
        p.drawRectangle({ x, y, width: 9, height: 9, borderColor: LINE, borderWidth: 0.8 });
        p.drawText(conditions[i]![c]!, { x: x + 16, y: y + 1, size: 9, font: regular, color: INK });
      }
    }

    numberLabel(p, bold, "26", 48, HTC_OVERLAY.page4.illnessHistory.y + 16);
    writeLine(p, 58, HTC_OVERLAY.page4.illnessHistory.y - 4, 240);
    writeLine(p, 320, HTC_OVERLAY.page4.illnessStatusNow.y - 4, 240);
    caption(p, regular, "List any illness you have had", 58, HTC_OVERLAY.page4.illnessHistory.y - 16);
    caption(p, regular, "How is it now?", 320, HTC_OVERLAY.page4.illnessStatusNow.y - 16);

    sectionTitle(p, bold, "References", 412);
    numberLabel(p, bold, "27", 48, 390);
    p.drawText("References — persons who know you well (note any relationship to you)", {
      x: 68,
      y: 390,
      size: 8,
      font: regular,
      color: MUTED,
    });

    p.drawText("(a) Your pastor", { x: 58, y: HTC_OVERLAY.page4.refPastorName.y + 16, size: 9, font: bold, color: ACCENT });
    writeLine(p, 58, HTC_OVERLAY.page4.refPastorName.y - 4, 500);
    writeLine(p, 58, HTC_OVERLAY.page4.refPastorAddress.y - 4, 320);
    writeLine(p, 400, HTC_OVERLAY.page4.refPastorPhone.y - 4, 150);
    caption(p, regular, "Address", 58, HTC_OVERLAY.page4.refPastorAddress.y - 16);
    caption(p, regular, "Phone", 400, HTC_OVERLAY.page4.refPastorPhone.y - 16);

    p.drawText("(b) An official of your local church / mission / organization", {
      x: 58,
      y: HTC_OVERLAY.page4.refOfficialName.y + 16,
      size: 9,
      font: bold,
      color: ACCENT,
    });
    writeLine(p, 58, HTC_OVERLAY.page4.refOfficialName.y - 4, 500);
    writeLine(p, 58, HTC_OVERLAY.page4.refOfficialAddress.y - 4, 320);
    writeLine(p, 400, HTC_OVERLAY.page4.refOfficialPhone.y - 4, 150);
    caption(p, regular, "Address", 58, HTC_OVERLAY.page4.refOfficialAddress.y - 16);
    caption(p, regular, "Phone", 400, HTC_OVERLAY.page4.refOfficialPhone.y - 16);

    p.drawText("(c) A responsible Christian friend outside your local church, employer or teacher", {
      x: 58,
      y: HTC_OVERLAY.page4.refFriendName.y + 16,
      size: 9,
      font: bold,
      color: ACCENT,
    });
    writeLine(p, 58, HTC_OVERLAY.page4.refFriendName.y - 4, 500);
    writeLine(p, 58, HTC_OVERLAY.page4.refFriendAddress.y - 4, 320);
    writeLine(p, 400, HTC_OVERLAY.page4.refFriendPhone.y - 4, 150);
    caption(p, regular, "Address", 58, HTC_OVERLAY.page4.refFriendAddress.y - 16);
    caption(p, regular, "Phone", 400, HTC_OVERLAY.page4.refFriendPhone.y - 16);
  }

  // ——— Page 5 ———
  {
    const p = pdf.addPage([HTC_PAGE.width, HTC_PAGE.height]);
    p.drawRectangle({
      x: 40,
      y: 430,
      width: 532,
      height: 310,
      borderColor: rgb(0.15, 0.16, 0.2),
      borderWidth: 1.2,
    });
    p.drawText("Declaration and Pledge", { x: 58, y: 716, size: 14, font: bold, color: INK });
    writeLine(p, 58, HTC_OVERLAY.page5.declarationName.y - 4, 260);
    caption(p, regular, "Name", 58, HTC_OVERLAY.page5.declarationName.y - 16);
    const pledge = [
      "I hereby declare that every piece of information given above is true and correct. If I am admitted to",
      "Hebron Theological College, I promise that:",
      "",
      "a. I shall try to promote and maintain high academic standards and a spirit of unity and love.",
      "b. I shall abide by the rules and regulations of Hebron Theological College.",
      "c. I shall submit myself to the right of the College administration to take any appropriate disciplinary",
      "action against me if, in their judgement, my behaviour, approach or doctrine is found contrary to the",
      "spirit and concern of Hebron Theological College.",
    ];
    let py = 660;
    for (const line of pledge) {
      p.drawText(line, { x: 58, y: py, size: 9, font: regular, color: INK });
      py -= 14;
    }
    writeLine(p, 58, HTC_OVERLAY.page5.applicantSignatureDate.y - 4, 160);
    writeLine(p, 260, HTC_OVERLAY.page5.applicantSignature.y - 4, 280);
    caption(p, regular, "Date", 58, HTC_OVERLAY.page5.applicantSignatureDate.y - 16);
    caption(p, regular, "Signature of the applicant", 260, HTC_OVERLAY.page5.applicantSignature.y - 16);

    p.drawRectangle({
      x: 40,
      y: 120,
      width: 532,
      height: 240,
      borderColor: ACCENT,
      borderWidth: 1,
      borderDashArray: [4, 3],
    });
    p.drawText("FOR REGISTRAR USE ONLY", { x: 58, y: 354, size: 10, font: bold, color: ACCENT });
    writeLine(p, 58, HTC_OVERLAY.page5.registrarDateReceived.y - 4, 200);
    writeLine(p, 320, HTC_OVERLAY.page5.registrarFeesReceived.y - 4, 220);
    caption(p, regular, "Date of receiving application", 58, HTC_OVERLAY.page5.registrarDateReceived.y - 16);
    caption(p, regular, "Fees — application / late fee received ($)", 320, HTC_OVERLAY.page5.registrarFeesReceived.y - 16);
    writeLine(p, 58, HTC_OVERLAY.page5.registrarApplicationNumber.y - 4, 220);
    caption(p, regular, "Application number", 58, HTC_OVERLAY.page5.registrarApplicationNumber.y - 16);
    p.drawCircle({ x: HTC_OVERLAY.page5.decisionApproved.x + 4, y: HTC_OVERLAY.page5.decisionApproved.y + 4, size: 5, borderColor: LINE, borderWidth: 1 });
    p.drawText("Approved", { x: HTC_OVERLAY.page5.decisionApproved.x + 14, y: HTC_OVERLAY.page5.decisionApproved.y, size: 9, font: regular, color: INK });
    p.drawCircle({ x: HTC_OVERLAY.page5.decisionRejected.x + 4, y: HTC_OVERLAY.page5.decisionRejected.y + 4, size: 5, borderColor: LINE, borderWidth: 1 });
    p.drawText("Rejected", { x: HTC_OVERLAY.page5.decisionRejected.x + 14, y: HTC_OVERLAY.page5.decisionRejected.y, size: 9, font: regular, color: INK });
    p.drawCircle({ x: HTC_OVERLAY.page5.decisionReferred.x + 4, y: HTC_OVERLAY.page5.decisionReferred.y + 4, size: 5, borderColor: LINE, borderWidth: 1 });
    p.drawText("Referred", { x: HTC_OVERLAY.page5.decisionReferred.x + 14, y: HTC_OVERLAY.page5.decisionReferred.y, size: 9, font: regular, color: INK });
    caption(p, regular, "Admission", 320, HTC_OVERLAY.page5.decisionApproved.y - 16);
    writeLine(p, 58, HTC_OVERLAY.page5.registrarDecisionDate.y - 4, 180);
    writeLine(p, 280, HTC_OVERLAY.page5.registrarSignature.y - 4, 260);
    caption(p, regular, "Date", 58, HTC_OVERLAY.page5.registrarDecisionDate.y - 16);
    caption(p, regular, "Signature", 280, HTC_OVERLAY.page5.registrarSignature.y - 16);
  }

  // ——— Page 6: digital instructions ———
  {
    const p = pdf.addPage([HTC_PAGE.width, HTC_PAGE.height]);
    await drawHeader(p, fonts, logoBytes, pdf);
    p.drawText("Digital submission", { x: 48, y: 700, size: 20, font: bold, color: INK });
    p.drawText("Bachelor of Theology application", { x: 48, y: 680, size: 11, font: regular, color: MUTED });
    const items = [
      "1. Passport-size photo uploaded on the first page of the online form.",
      "2. Academic documents — up to 5 files (certificates or transcripts).",
      "3. Written personal testimony on the application materials page.",
      "4. $50 (US) application fee paid online by card (processing included).",
    ];
    let y = 630;
    for (const item of items) {
      p.drawText(item, { x: 48, y, size: 11, font: regular, color: INK });
      y -= 28;
    }
    p.drawText("CONTACT US", { x: 48, y: 470, size: 10, font: bold, color: ACCENT });
    p.drawText("admissions@ipchouston.com · ipchouston.com", { x: 48, y: 450, size: 10, font: regular, color: INK });
  }

  return pdf.save();
}

async function main() {
  const bytes = await buildPdf();
  const outDir = path.join(process.cwd(), "assets", "embedded-forms");
  await mkdir(outDir, { recursive: true });
  const out = path.join(outDir, "htc-application.pdf");
  await writeFile(out, bytes);
  console.log(`Wrote ${out} (${bytes.length} bytes)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
