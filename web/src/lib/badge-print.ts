import { barcodeSvgDataUrl } from "@/lib/badge-print-barcode";
import type {
  BadgeHorizontalLayout,
  BadgeLabelSize,
  BadgeOrientation,
  BadgePrintSettings,
} from "@/generated/prisma";
import {
  type ExportFieldOption,
  resolveRegistrationExportFieldValue,
  type RegistrationFieldValueRow,
} from "@/lib/registration-export";
import { getPublicAppBaseUrl } from "@/lib/public-app-url";
import { registrationTicketUrl } from "@/lib/registration-ticket-url";

/** Selected registration form field to include on each badge. */
export type BadgeFormFieldSelection = {
  id: string;
  fieldKey: string;
  /** Font size (pt) for this field on horizontal Brother badges. */
  fontPt: number;
};

export type ResolvedBadgePrintSettings = {
  enabled: boolean;
  labelSize: BadgeLabelSize;
  orientation: BadgeOrientation;
  horizontalLayout: BadgeHorizontalLayout;
  showChildName: boolean;
  showRegistrationNumber: boolean;
  showClassroomName: boolean;
  showBadgeDisplayName: boolean;
  showCheckInLabel: boolean;
  showSeasonName: boolean;
  showQrCode: boolean;
  showAllergyFlag: boolean;
  logoUrl: string | null;
  formFields: BadgeFormFieldSelection[];
  autoPrintOnCheckIn: boolean;
  typography: BadgeTypographySettings;
};

/** Font sizes (pt) and spacing (inches) for badge rendering — especially Brother horizontal labels. */
export type BadgeTypographySettings = {
  namePt: number;
  classPt: number;
  detailPt: number;
  seasonPt: number;
  codePt: number;
  timestampPt: number;
  /** Gap between field blocks (guardian, medical, etc.). */
  lineGapIn: number;
  /** Gap between wrapped lines within one field. */
  wrapGapIn: number;
  /** QR square size on horizontal Brother badges. */
  qrSizeIn: number;
  /** Print order for KidCheck detail blocks below the divider. */
  detailFieldOrder: BadgeDetailFieldId[];
  /** Bold field labels on detail lines (e.g. "Guardian:"). */
  detailLabelBold: boolean;
  /** Bold values after detail labels (e.g. the guardian name). */
  detailValueBold: boolean;
};

/** Reorderable blocks on horizontal KidCheck / Name + code badges (below header). */
export type BadgeDetailFieldId = "season" | "class" | "allergyFlag" | "formFields";

export const DEFAULT_BADGE_DETAIL_FIELD_ORDER: BadgeDetailFieldId[] = [
  "season",
  "class",
  "formFields",
  "allergyFlag",
];

export const BADGE_DETAIL_FIELD_OPTIONS: {
  id: BadgeDetailFieldId;
  label: string;
  description: string;
}[] = [
  { id: "season", label: "Season name", description: "When enabled under Built-in fields." },
  { id: "class", label: "Class / badge name", description: "Classroom or badge display name." },
  {
    id: "formFields",
    label: "Registration form fields",
    description: "Print in the order listed under Registration form fields below.",
  },
  {
    id: "allergyFlag",
    label: "Allergy flag",
    description: 'When enabled under Built-in fields — prints "Allergies on file".',
  },
];

export const DEFAULT_BADGE_TYPOGRAPHY: BadgeTypographySettings = {
  namePt: 22,
  classPt: 18,
  detailPt: 12,
  seasonPt: 10,
  codePt: 11,
  timestampPt: 9,
  lineGapIn: 0.05,
  wrapGapIn: 0.018,
  qrSizeIn: 0.95,
  detailFieldOrder: [...DEFAULT_BADGE_DETAIL_FIELD_ORDER],
  detailLabelBold: true,
  detailValueBold: false,
};

export const DEFAULT_BADGE_PRINT_SETTINGS: ResolvedBadgePrintSettings = {
  enabled: true,
  labelSize: "LABEL_2X3",
  orientation: "VERTICAL",
  horizontalLayout: "STANDARD",
  showChildName: true,
  showRegistrationNumber: true,
  showClassroomName: true,
  showBadgeDisplayName: true,
  showCheckInLabel: false,
  showSeasonName: true,
  showQrCode: true,
  showAllergyFlag: false,
  logoUrl: null,
  formFields: [],
  autoPrintOnCheckIn: false,
  typography: { ...DEFAULT_BADGE_TYPOGRAPHY },
};

export const DEFAULT_BADGE_FORM_FIELD_FONT_PT = 12;

export type BadgePrintLine = {
  kind: "season" | "name" | "number" | "class" | "badgeName" | "checkInLabel" | "allergy" | "formField";
  text: string;
  label?: string;
  fieldKey?: string;
  fontPt?: number;
};

export type BadgePrintStructured = {
  firstName: string;
  lastName: string;
  /** Full child name for VBS horizontal layout (regular weight). */
  childNameLine: string | null;
  /** Event / season title without year suffix. */
  eventLine: string | null;
  securityCode: string | null;
  serviceLine: string | null;
  seasonLine: string | null;
  classLine: string | null;
  locationLine: string | null;
  tShirtSizeLine: string | null;
  tShirtSizeLabel: string;
  guardianLine: string | null;
  guardianPhone: string | null;
  /** Full allergy notes text for the badge (not just a flag). */
  allergiesLine: string | null;
  birthdate: string | null;
  medicalLine: string | null;
  notesLine: string | null;
  answerLines: BadgePrintLine[];
  printedAt: string | null;
};

export type BadgePrintPayload = {
  registrationId: string;
  settings: ResolvedBadgePrintSettings;
  lines: BadgePrintLine[];
  structured: BadgePrintStructured;
  childName: string;
  qrDataUrl: string | null;
  barcodeDataUrl: string | null;
  ticketUrl: string | null;
};

export const BADGE_HORIZONTAL_LAYOUT_OPTIONS: {
  value: BadgeHorizontalLayout;
  label: string;
  description: string;
}[] = [
  {
    value: "STANDARD",
    label: "Standard horizontal",
    description: "Logo and fields on the left, QR code on the right (current default).",
  },
  {
    value: "NAME_CODE_HEADER",
    label: "Name + code header",
    description:
      "Large first and last name top-left, registration code in a box top-right, divider, then location and custom answers.",
  },
  {
    value: "KIDCHECK",
    label: "KidCheck-style",
    description:
      "Name and registration code header, detail lines below, QR and optional logo strip on the right, timestamp at bottom.",
  },
];

const LABEL_SIZE_OPTIONS: { value: BadgeLabelSize; label: string }[] = [
  { value: "LABEL_2X3", label: '2″ × 3″ (standard name badge)' },
  { value: "LABEL_4X6", label: '4″ × 6″ (large badge)' },
  { value: "LABEL_62MM", label: "62 mm continuous roll" },
];

const SAMPLE_FORM_FIELD_VALUES: Record<string, string> = {
  "guardian:guardianFirstName": "Maria",
  "guardian:guardianLastName": "Rivera",
  "guardian:guardianEmail": "maria@example.com",
  "guardian:guardianPhone": "(555) 123-4567",
  "child:childFirstName": "Alex",
  "child:childLastName": "Rivera",
  "child:childDateOfBirth": "2018-06-15",
  "child:allergiesNotes": "Peanuts",
  "child:tShirtSize": "Youth Large",
  "child:shirtSize": "Youth Large",
};

export function badgeLabelSizeOptions() {
  return LABEL_SIZE_OPTIONS;
}

export function parseBadgeLabelSize(raw: string): BadgeLabelSize {
  if (raw === "LABEL_4X6" || raw === "LABEL_62MM") return raw;
  return "LABEL_2X3";
}

export function parseBadgeOrientation(raw: string): BadgeOrientation {
  return raw === "HORIZONTAL" ? "HORIZONTAL" : "VERTICAL";
}

export function parseBadgeHorizontalLayout(raw: string): BadgeHorizontalLayout {
  if (raw === "NAME_CODE_HEADER" || raw === "KIDCHECK") return raw;
  return "STANDARD";
}

function parseTypographyBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "1" || value === "on") return true;
  if (value === "false" || value === "0" || value === "off") return false;
  return fallback;
}

function clampTypographyNumber(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
): number {
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number.parseFloat(value)
        : Number.NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function parseBadgeDetailFieldOrder(raw: unknown): BadgeDetailFieldId[] {
  const allowed = new Set<BadgeDetailFieldId>(DEFAULT_BADGE_DETAIL_FIELD_ORDER);
  if (!Array.isArray(raw)) return [...DEFAULT_BADGE_DETAIL_FIELD_ORDER];
  const out: BadgeDetailFieldId[] = [];
  for (const item of raw) {
    if (typeof item !== "string" || !allowed.has(item as BadgeDetailFieldId)) continue;
    const id = item as BadgeDetailFieldId;
    if (!out.includes(id)) out.push(id);
  }
  for (const id of DEFAULT_BADGE_DETAIL_FIELD_ORDER) {
    if (!out.includes(id)) out.push(id);
  }
  return out;
}

export function parseBadgeTypographyJson(raw: unknown): BadgeTypographySettings {
  const d = DEFAULT_BADGE_TYPOGRAPHY;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ...d };
  const o = raw as Record<string, unknown>;
  return {
    namePt: clampTypographyNumber(o.namePt, 8, 36, d.namePt),
    classPt: clampTypographyNumber(o.classPt, 8, 32, d.classPt),
    detailPt: clampTypographyNumber(o.detailPt, 6, 24, d.detailPt),
    seasonPt: clampTypographyNumber(o.seasonPt, 6, 18, d.seasonPt),
    codePt: clampTypographyNumber(o.codePt, 6, 18, d.codePt),
    timestampPt: clampTypographyNumber(o.timestampPt, 6, 16, d.timestampPt),
    lineGapIn: clampTypographyNumber(o.lineGapIn, 0, 0.12, d.lineGapIn),
    wrapGapIn: clampTypographyNumber(o.wrapGapIn, 0, 0.08, d.wrapGapIn),
    qrSizeIn: clampTypographyNumber(o.qrSizeIn, 0.45, 1.2, d.qrSizeIn),
    detailFieldOrder: parseBadgeDetailFieldOrder(o.detailFieldOrder),
    detailLabelBold: parseTypographyBoolean(o.detailLabelBold, d.detailLabelBold),
    detailValueBold: parseTypographyBoolean(o.detailValueBold, d.detailValueBold),
  };
}

export function parseBadgeTypographyForm(raw: string): BadgeTypographySettings {
  if (!raw.trim()) return { ...DEFAULT_BADGE_TYPOGRAPHY };
  try {
    return parseBadgeTypographyJson(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_BADGE_TYPOGRAPHY };
  }
}

export function parseBadgeFormFieldsJson(raw: unknown): BadgeFormFieldSelection[] {
  if (!Array.isArray(raw)) return [];
  const out: BadgeFormFieldSelection[] = [];
  const seen = new Set<string>();

  for (const item of raw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const row = item as Record<string, unknown>;
    const fieldKey = typeof row.fieldKey === "string" ? row.fieldKey.trim() : "";
    if (!fieldKey || seen.has(fieldKey)) continue;
    seen.add(fieldKey);
    const id =
      typeof row.id === "string" && row.id.trim()
        ? row.id.trim()
        : `field-${out.length + 1}`;
    out.push({
      id,
      fieldKey,
      fontPt: clampTypographyNumber(
        row.fontPt,
        6,
        24,
        DEFAULT_BADGE_FORM_FIELD_FONT_PT,
      ),
    });
  }
  return out.slice(0, 12);
}

/** Resolve print size for a registration form field on the badge. */
export function badgeFormFieldFontPt(
  settings: ResolvedBadgePrintSettings,
  fieldKey: string,
): number {
  const row = settings.formFields.find((f) => f.fieldKey === fieldKey);
  return row?.fontPt ?? settings.typography.detailPt;
}

export function parseBadgeFormFieldsForm(raw: string): BadgeFormFieldSelection[] {
  if (!raw.trim()) return [];
  try {
    return parseBadgeFormFieldsJson(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function resolveBadgePrintSettings(
  row: BadgePrintSettings | null | undefined,
): ResolvedBadgePrintSettings {
  if (!row) return { ...DEFAULT_BADGE_PRINT_SETTINGS, formFields: [] };
  return {
    enabled: row.enabled,
    labelSize: row.labelSize,
    orientation: row.orientation,
    horizontalLayout: row.horizontalLayout,
    showChildName: row.showChildName,
    showRegistrationNumber: row.showRegistrationNumber,
    showClassroomName: row.showClassroomName,
    showBadgeDisplayName: row.showBadgeDisplayName,
    showCheckInLabel: row.showCheckInLabel,
    showSeasonName: row.showSeasonName,
    showQrCode: row.showQrCode,
    showAllergyFlag: row.showAllergyFlag,
    logoUrl: row.logoUrl?.trim() || null,
    formFields: parseBadgeFormFieldsJson(row.customFieldsJson),
    autoPrintOnCheckIn: row.autoPrintOnCheckIn,
    typography: parseBadgeTypographyJson(row.typographyJson),
  };
}

export function badgeLabelPageCss(
  labelSize: BadgeLabelSize,
  orientation: BadgeOrientation = "VERTICAL",
): { pageSize: string; width: string; height: string; isHorizontal: boolean } {
  let width: string;
  let height: string;

  switch (labelSize) {
    case "LABEL_4X6":
      width = "4in";
      height = "6in";
      break;
    case "LABEL_62MM":
      width = "62mm";
      height = "100mm";
      break;
    default:
      width = "2in";
      height = "3in";
  }

  const isHorizontal = orientation === "HORIZONTAL";
  if (isHorizontal) {
    return {
      pageSize: `${height} ${width}`,
      width: height,
      height: width,
      isHorizontal: true,
    };
  }

  return { pageSize: `${width} ${height}`, width, height, isHorizontal: false };
}

function formFieldLabel(fieldKey: string, fieldOptions: ExportFieldOption[]): string {
  return fieldOptions.find((o) => o.key === fieldKey)?.label ?? fieldKey;
}

/** Strip export audience prefix — badges show the field label only. */
function badgeFormFieldLabel(fieldKey: string, fieldOptions: ExportFieldOption[]): string {
  const full = formFieldLabel(fieldKey, fieldOptions);
  return full.replace(/^(Guardian|Child):\s*/i, "");
}

function sampleFormFieldValue(fieldKey: string, fieldOptions: ExportFieldOption[]): string {
  if (SAMPLE_FORM_FIELD_VALUES[fieldKey]) return SAMPLE_FORM_FIELD_VALUES[fieldKey]!;
  const label = badgeFormFieldLabel(fieldKey, fieldOptions);
  return label ? `Sample ${label.toLowerCase()}` : "Sample answer";
}

type BuildBadgeInput = {
  settings: ResolvedBadgePrintSettings;
  registrationId: string;
  childFirstName: string;
  childLastName: string;
  childDateOfBirth?: Date | string | null;
  allergiesNotes: string | null;
  registrationNumber: string | null;
  submissionCode?: string | null;
  staffNotes?: string | null;
  guardianFirstName?: string | null;
  guardianLastName?: string | null;
  guardianPhone?: string | null;
  checkInToken: string | null;
  publicRegistrationSlug?: string | null;
  seasonName: string;
  seasonYear: number;
  classroomName: string | null;
  badgeDisplayName: string | null;
  checkInLabel: string | null;
  qrDataUrl?: string | null;
  registrationRow?: RegistrationFieldValueRow | null;
  fieldOptions?: ExportFieldOption[];
  printedAt?: Date;
  checkedInAt?: Date | null;
};

/** Check-in / print timestamp in Central Time (CST/CDT). */
export function formatBadgeCheckInTimestamp(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

function isTShirtFormField(fieldKey: string, fieldOptions: ExportFieldOption[]): boolean {
  const label = badgeFormFieldLabel(fieldKey, fieldOptions).toLowerCase();
  const key = fieldKey.toLowerCase();
  return label.includes("shirt") || key.includes("shirt");
}

function isAllergyFormField(fieldKey: string, fieldOptions: ExportFieldOption[]): boolean {
  const label = badgeFormFieldLabel(fieldKey, fieldOptions).toLowerCase();
  const key = fieldKey.toLowerCase();
  return label.includes("allerg") || key.includes("allerg");
}

function resolveTShirtSizeLine(input: BuildBadgeInput): string | null {
  const fieldOptions = input.fieldOptions ?? [];
  for (const field of input.settings.formFields) {
    if (!isTShirtFormField(field.fieldKey, fieldOptions)) continue;
    const text = input.registrationRow
      ? resolveRegistrationExportFieldValue(input.registrationRow, input.seasonName, field.fieldKey)
      : sampleFormFieldValue(field.fieldKey, fieldOptions);
    if (text.trim()) return text.trim();
  }
  return null;
}

function resolveTShirtSizeLabel(input: BuildBadgeInput): string {
  const fieldOptions = input.fieldOptions ?? [];
  for (const field of input.settings.formFields) {
    if (!isTShirtFormField(field.fieldKey, fieldOptions)) continue;
    const label = badgeFormFieldLabel(field.fieldKey, fieldOptions);
    if (label.trim()) return label.endsWith(":") ? label : `${label}:`;
  }
  return "T-Shirt Size:";
}

export function formatSampleRegistrationNumber(
  prefix: string | null | undefined,
  seqDigits: number,
  seasonYear: number,
): string {
  const p = prefix?.trim();
  if (p) {
    const digits = Math.min(8, Math.max(2, Math.floor(seqDigits) || 3));
    return `${p}${String(1).padStart(digits, "0")}`;
  }
  return `VBS-${seasonYear}-001`;
}

function buildStructuredData(input: BuildBadgeInput, answerLines: BadgePrintLine[]): BadgePrintStructured {
  const classLine =
    (input.settings.showBadgeDisplayName && input.badgeDisplayName?.trim()) ||
    (input.settings.showClassroomName ? input.classroomName?.trim() : null) ||
    null;
  const checkIn = input.settings.showCheckInLabel ? input.checkInLabel?.trim() : null;
  const eventLine = input.settings.showSeasonName ? input.seasonName.trim() : null;
  const seasonLine = eventLine ? `${eventLine} (${input.seasonYear})` : null;

  const serviceParts: string[] = [];
  if (seasonLine) serviceParts.push(seasonLine);
  if (classLine) serviceParts.push(classLine);
  if (checkIn) serviceParts.push(checkIn);

  const locationLine = serviceParts.join(" · ") || null;
  const serviceLine =
    eventLine && classLine ? `${eventLine} — ${classLine}` : locationLine;

  const medicalLine =
    input.allergiesNotes?.trim() ||
    (input.registrationId === "preview" ? "Peanut / tree nut allergy" : null);

  const securityCode =
    input.settings.showRegistrationNumber && input.registrationNumber
      ? input.registrationNumber
      : input.submissionCode?.trim() || null;

  const childNameLine =
    input.settings.showChildName
      ? `${input.childFirstName} ${input.childLastName}`.trim() || null
      : null;

  const guardianLine =
    [input.guardianFirstName?.trim(), input.guardianLastName?.trim()].filter(Boolean).join(" ") || null;
  const guardianPhone = input.guardianPhone?.trim() || null;
  const tShirtSizeLine =
    resolveTShirtSizeLine(input) ??
    (input.registrationId === "preview" ? "Youth Large" : null);
  const tShirtSizeLabel = resolveTShirtSizeLabel(input);

  const allergiesLine = medicalLine;

  const timestampSource = input.checkedInAt ?? input.printedAt ?? new Date();
  const printedAt = formatBadgeCheckInTimestamp(timestampSource);

  return {
    firstName: input.settings.showChildName ? input.childFirstName.trim() : "",
    lastName: input.settings.showChildName ? input.childLastName.trim() : "",
    childNameLine,
    eventLine,
    securityCode,
    serviceLine,
    seasonLine,
    classLine,
    locationLine,
    tShirtSizeLine,
    tShirtSizeLabel,
    guardianLine,
    guardianPhone,
    allergiesLine,
    birthdate: null,
    medicalLine,
    notesLine: null,
    answerLines,
    printedAt,
  };
}

export function buildBadgePrintPayload(input: BuildBadgeInput): BadgePrintPayload {
  const childName = `${input.childFirstName} ${input.childLastName}`.trim();
  const lines: BadgePrintLine[] = [];
  const fieldOptions = input.fieldOptions ?? [];

  if (input.settings.showSeasonName) {
    lines.push({ kind: "season", text: `${input.seasonName} (${input.seasonYear})` });
  }
  if (input.settings.showChildName && childName) {
    lines.push({ kind: "name", text: childName });
  }
  if (input.settings.showRegistrationNumber && input.registrationNumber) {
    lines.push({ kind: "number", text: input.registrationNumber });
  }
  if (input.settings.showBadgeDisplayName && input.badgeDisplayName?.trim()) {
    lines.push({ kind: "badgeName", text: input.badgeDisplayName.trim() });
  } else if (input.settings.showClassroomName && input.classroomName) {
    lines.push({ kind: "class", text: input.classroomName });
  }
  if (input.settings.showCheckInLabel && input.checkInLabel?.trim()) {
    lines.push({ kind: "checkInLabel", text: input.checkInLabel.trim() });
  }
  if (input.settings.showAllergyFlag && input.allergiesNotes?.trim()) {
    lines.push({ kind: "allergy", text: "Allergies on file" });
  }

  for (const field of input.settings.formFields) {
    if (isTShirtFormField(field.fieldKey, fieldOptions)) continue;
    if (isAllergyFormField(field.fieldKey, fieldOptions)) continue;
    const label = badgeFormFieldLabel(field.fieldKey, fieldOptions);
    const text = input.registrationRow
      ? resolveRegistrationExportFieldValue(input.registrationRow, input.seasonName, field.fieldKey)
      : sampleFormFieldValue(field.fieldKey, fieldOptions);
    if (!text.trim()) continue;
    lines.push({
      kind: "formField",
      label,
      text: text.trim(),
      fieldKey: field.fieldKey,
      fontPt: field.fontPt,
    });
  }

  const base = getPublicAppBaseUrl();
  const ticketUrl =
    input.checkInToken && input.settings.showQrCode
      ? registrationTicketUrl(input.checkInToken, base, {
          publicRegistrationSlug: input.publicRegistrationSlug ?? null,
        })
      : null;

  const answerLines = lines.filter((l) => l.kind === "formField");
  const structured = buildStructuredData(input, answerLines);
  const barcodeSource = structured.securityCode ?? input.registrationId.slice(-8).toUpperCase();
  const barcodeDataUrl =
    input.settings.orientation === "HORIZONTAL" &&
    input.settings.horizontalLayout === "KIDCHECK" &&
    !input.settings.showQrCode
      ? barcodeSvgDataUrl(barcodeSource)
      : null;

  return {
    registrationId: input.registrationId,
    settings: input.settings,
    lines,
    structured,
    childName,
    qrDataUrl: input.qrDataUrl ?? null,
    barcodeDataUrl,
    ticketUrl,
  };
}

export type SampleBadgePreviewOptions = {
  seasonName?: string;
  seasonYear?: number;
  registrationNumberPrefix?: string | null;
  registrationNumberSeqDigits?: number;
};

export function sampleBadgePreviewPayload(
  settings: ResolvedBadgePrintSettings,
  fieldOptions: ExportFieldOption[] = [],
  options: SampleBadgePreviewOptions = {},
): BadgePrintPayload {
  const seasonName = options.seasonName ?? "Summer VBS";
  const seasonYear = options.seasonYear ?? 2026;

  return buildBadgePrintPayload({
    settings,
    registrationId: "preview",
    childFirstName: "Alex",
    childLastName: "Rivera",
    childDateOfBirth: "2018-06-15",
    allergiesNotes:
      settings.showAllergyFlag || settings.formFields.some((f) => f.fieldKey === "child:allergiesNotes")
        ? "Peanut / tree nut allergy"
        : null,
    registrationNumber: settings.showRegistrationNumber
      ? formatSampleRegistrationNumber(
          options.registrationNumberPrefix,
          options.registrationNumberSeqDigits ?? 3,
          seasonYear,
        )
      : null,
    submissionCode: "ABC123",
    staffNotes: settings.formFields.some((f) => f.fieldKey === "staffNotes")
      ? "Potty training — please take to bathroom every 30 minutes."
      : null,
    guardianFirstName: "Maria",
    guardianLastName: "Rivera",
    guardianPhone: "(555) 123-4567",
    checkInToken: settings.showQrCode ? "preview-token" : null,
    seasonName,
    seasonYear,
    classroomName: "Explorers",
    badgeDisplayName: settings.showBadgeDisplayName ? "Explorers" : null,
    checkInLabel: settings.showCheckInLabel ? "Room B12" : null,
    qrDataUrl: settings.showQrCode
      ? "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'%3E%3Crect width='120' height='120' fill='%23fff'/%3E%3Ctext x='60' y='64' text-anchor='middle' font-size='12' fill='%2364748b'%3EQR%3C/text%3E%3C/svg%3E"
      : null,
    fieldOptions,
    printedAt: new Date("2026-06-11T14:30:00.000Z"),
  });
}
