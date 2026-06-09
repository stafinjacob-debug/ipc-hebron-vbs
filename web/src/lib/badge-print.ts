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

function registrationTicketUrl(checkInToken: string, baseUrl?: string): string {
  const b = (baseUrl ?? getPublicAppBaseUrl()).replace(/\/$/, "");
  return `${b}/register/ticket?t=${encodeURIComponent(checkInToken)}`;
}

/** Selected registration form field to include on each badge. */
export type BadgeFormFieldSelection = {
  id: string;
  fieldKey: string;
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
};

export type BadgePrintLine = {
  kind: "season" | "name" | "number" | "class" | "badgeName" | "checkInLabel" | "allergy" | "formField";
  text: string;
  label?: string;
};

export type BadgePrintStructured = {
  firstName: string;
  lastName: string;
  securityCode: string | null;
  serviceLine: string | null;
  locationLine: string | null;
  guardianLine: string | null;
  guardianPhone: string | null;
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
      "Security code box, service/class line, guardian and birthdate, medical notes, vertical logo strip, timestamp and barcode.",
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
    out.push({ id, fieldKey });
  }
  return out.slice(0, 12);
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

function sampleFormFieldValue(fieldKey: string): string {
  return SAMPLE_FORM_FIELD_VALUES[fieldKey] ?? "Sample answer";
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
  seasonName: string;
  seasonYear: number;
  classroomName: string | null;
  badgeDisplayName: string | null;
  checkInLabel: string | null;
  qrDataUrl?: string | null;
  registrationRow?: RegistrationFieldValueRow | null;
  fieldOptions?: ExportFieldOption[];
  printedAt?: Date;
};

function formatBirthdate(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "numeric" });
}

function formFieldsInclude(settings: ResolvedBadgePrintSettings, ...keys: string[]): boolean {
  const wanted = new Set(keys);
  return settings.formFields.some((f) => wanted.has(f.fieldKey));
}

function shouldShowGuardianOnStructuredBadge(settings: ResolvedBadgePrintSettings): boolean {
  return formFieldsInclude(
    settings,
    "guardian:guardianFirstName",
    "guardian:guardianLastName",
    "guardian:guardianPhone",
  );
}

function shouldShowBirthdateOnStructuredBadge(settings: ResolvedBadgePrintSettings): boolean {
  return formFieldsInclude(settings, "child:childDateOfBirth");
}

function shouldShowStaffNotesOnStructuredBadge(settings: ResolvedBadgePrintSettings): boolean {
  return formFieldsInclude(settings, "staffNotes");
}

function shouldShowAllergyDetailsOnStructuredBadge(settings: ResolvedBadgePrintSettings): boolean {
  return formFieldsInclude(settings, "child:allergiesNotes");
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
  const classOrBadge =
    input.badgeDisplayName?.trim() ||
    (input.settings.showClassroomName ? input.classroomName?.trim() : null) ||
    null;
  const checkIn = input.settings.showCheckInLabel ? input.checkInLabel?.trim() : null;

  const serviceParts: string[] = [];
  if (input.settings.showSeasonName) {
    serviceParts.push(`${input.seasonName} (${input.seasonYear})`);
  }
  if (classOrBadge) serviceParts.push(classOrBadge);
  if (checkIn) serviceParts.push(checkIn);

  const locationLine = serviceParts.join(" · ") || null;
  const serviceLine =
    input.settings.showSeasonName && classOrBadge
      ? `${input.seasonName} — ${classOrBadge}`
      : locationLine;

  const showGuardian = shouldShowGuardianOnStructuredBadge(input.settings);
  const guardianFirst = showGuardian ? (input.guardianFirstName?.trim() ?? "") : "";
  const guardianLast = showGuardian ? (input.guardianLastName?.trim() ?? "") : "";
  const guardianLine =
    showGuardian && (guardianLast || guardianFirst)
      ? `${guardianLast}${guardianLast && guardianFirst ? ", " : ""}${guardianFirst}`.trim()
      : null;

  let medicalLine: string | null = null;
  if (input.settings.showAllergyFlag && input.allergiesNotes?.trim()) {
    medicalLine = "Allergies on file";
  } else if (
    shouldShowAllergyDetailsOnStructuredBadge(input.settings) &&
    input.allergiesNotes?.trim()
  ) {
    medicalLine = input.allergiesNotes.trim();
  }

  const securityCode =
    input.settings.showRegistrationNumber && input.registrationNumber
      ? input.registrationNumber
      : input.submissionCode?.trim() || null;

  const printedAt = (input.printedAt ?? new Date()).toLocaleString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return {
    firstName: input.settings.showChildName ? input.childFirstName.trim() : "",
    lastName: input.settings.showChildName ? input.childLastName.trim() : "",
    securityCode,
    serviceLine,
    locationLine,
    guardianLine,
    guardianPhone:
      showGuardian && formFieldsInclude(input.settings, "guardian:guardianPhone")
        ? input.guardianPhone?.trim() || null
        : null,
    birthdate: shouldShowBirthdateOnStructuredBadge(input.settings)
      ? formatBirthdate(input.childDateOfBirth)
      : null,
    medicalLine,
    notesLine: shouldShowStaffNotesOnStructuredBadge(input.settings)
      ? input.staffNotes?.trim() || null
      : null,
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
    const label = formFieldLabel(field.fieldKey, fieldOptions);
    const text = input.registrationRow
      ? resolveRegistrationExportFieldValue(input.registrationRow, input.seasonName, field.fieldKey)
      : sampleFormFieldValue(field.fieldKey);
    if (!text.trim()) continue;
    lines.push({ kind: "formField", label, text: text.trim() });
  }

  const base = getPublicAppBaseUrl();
  const ticketUrl =
    input.checkInToken && input.settings.showQrCode
      ? registrationTicketUrl(input.checkInToken, base)
      : null;

  const answerLines = lines.filter((l) => l.kind === "formField");
  const structured = buildStructuredData(input, answerLines);
  const barcodeSource = structured.securityCode ?? input.registrationId.slice(-8).toUpperCase();
  const barcodeDataUrl =
    input.settings.orientation === "HORIZONTAL" && input.settings.horizontalLayout === "KIDCHECK"
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
  const showGuardian = shouldShowGuardianOnStructuredBadge(settings);
  const showBirthdate = shouldShowBirthdateOnStructuredBadge(settings);
  const showStaffNotes = shouldShowStaffNotesOnStructuredBadge(settings);
  const showAllergyDetails = shouldShowAllergyDetailsOnStructuredBadge(settings);

  return buildBadgePrintPayload({
    settings,
    registrationId: "preview",
    childFirstName: "Alex",
    childLastName: "Rivera",
    childDateOfBirth: showBirthdate ? "2018-06-15" : null,
    allergiesNotes:
      settings.showAllergyFlag || showAllergyDetails ? "Peanut / tree nut allergy" : null,
    registrationNumber: settings.showRegistrationNumber
      ? formatSampleRegistrationNumber(
          options.registrationNumberPrefix,
          options.registrationNumberSeqDigits ?? 3,
          seasonYear,
        )
      : null,
    submissionCode: "ABC123",
    staffNotes: showStaffNotes
      ? "Potty training — please take to bathroom every 30 minutes."
      : null,
    guardianFirstName: showGuardian ? "Maria" : null,
    guardianLastName: showGuardian ? "Rivera" : null,
    guardianPhone:
      showGuardian && formFieldsInclude(settings, "guardian:guardianPhone")
        ? "(555) 123-4567"
        : null,
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
  });
}
