import type { BadgeLabelSize, BadgeOrientation, BadgePrintSettings } from "@/generated/prisma";
import { getPublicAppBaseUrl } from "@/lib/public-app-url";

function registrationTicketUrl(checkInToken: string, baseUrl?: string): string {
  const b = (baseUrl ?? getPublicAppBaseUrl()).replace(/\/$/, "");
  return `${b}/register/ticket?t=${encodeURIComponent(checkInToken)}`;
}

export type BadgeCustomField = {
  id: string;
  label: string;
  text: string;
};

export type ResolvedBadgePrintSettings = {
  enabled: boolean;
  labelSize: BadgeLabelSize;
  orientation: BadgeOrientation;
  showChildName: boolean;
  showRegistrationNumber: boolean;
  showClassroomName: boolean;
  showBadgeDisplayName: boolean;
  showCheckInLabel: boolean;
  showSeasonName: boolean;
  showQrCode: boolean;
  showAllergyFlag: boolean;
  logoUrl: string | null;
  customFields: BadgeCustomField[];
  autoPrintOnCheckIn: boolean;
};

export const DEFAULT_BADGE_PRINT_SETTINGS: ResolvedBadgePrintSettings = {
  enabled: true,
  labelSize: "LABEL_2X3",
  orientation: "VERTICAL",
  showChildName: true,
  showRegistrationNumber: true,
  showClassroomName: true,
  showBadgeDisplayName: true,
  showCheckInLabel: false,
  showSeasonName: true,
  showQrCode: true,
  showAllergyFlag: false,
  logoUrl: null,
  customFields: [],
  autoPrintOnCheckIn: false,
};

export type BadgePrintLine = {
  kind: "season" | "name" | "number" | "class" | "badgeName" | "checkInLabel" | "allergy" | "custom";
  text: string;
  label?: string;
};

export type BadgePrintPayload = {
  registrationId: string;
  settings: ResolvedBadgePrintSettings;
  lines: BadgePrintLine[];
  childName: string;
  qrDataUrl: string | null;
  ticketUrl: string | null;
};

const LABEL_SIZE_OPTIONS: { value: BadgeLabelSize; label: string }[] = [
  { value: "LABEL_2X3", label: '2″ × 3″ (standard name badge)' },
  { value: "LABEL_4X6", label: '4″ × 6″ (large badge)' },
  { value: "LABEL_62MM", label: "62 mm continuous roll" },
];

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

export function parseBadgeCustomFieldsJson(raw: unknown): BadgeCustomField[] {
  if (!Array.isArray(raw)) return [];
  const out: BadgeCustomField[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const row = item as Record<string, unknown>;
    const text = typeof row.text === "string" ? row.text.trim() : "";
    if (!text) continue;
    const label = typeof row.label === "string" ? row.label.trim() : "";
    const id =
      typeof row.id === "string" && row.id.trim()
        ? row.id.trim()
        : `custom-${out.length + 1}`;
    out.push({ id, label, text });
  }
  return out.slice(0, 12);
}

export function parseBadgeCustomFieldsForm(raw: string): BadgeCustomField[] {
  if (!raw.trim()) return [];
  try {
    return parseBadgeCustomFieldsJson(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function resolveBadgePrintSettings(
  row: BadgePrintSettings | null | undefined,
): ResolvedBadgePrintSettings {
  if (!row) return { ...DEFAULT_BADGE_PRINT_SETTINGS, customFields: [] };
  return {
    enabled: row.enabled,
    labelSize: row.labelSize,
    orientation: row.orientation,
    showChildName: row.showChildName,
    showRegistrationNumber: row.showRegistrationNumber,
    showClassroomName: row.showClassroomName,
    showBadgeDisplayName: row.showBadgeDisplayName,
    showCheckInLabel: row.showCheckInLabel,
    showSeasonName: row.showSeasonName,
    showQrCode: row.showQrCode,
    showAllergyFlag: row.showAllergyFlag,
    logoUrl: row.logoUrl?.trim() || null,
    customFields: parseBadgeCustomFieldsJson(row.customFieldsJson),
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

type BuildBadgeInput = {
  settings: ResolvedBadgePrintSettings;
  registrationId: string;
  childFirstName: string;
  childLastName: string;
  allergiesNotes: string | null;
  registrationNumber: string | null;
  checkInToken: string | null;
  seasonName: string;
  seasonYear: number;
  classroomName: string | null;
  badgeDisplayName: string | null;
  checkInLabel: string | null;
  qrDataUrl?: string | null;
};

export function buildBadgePrintPayload(input: BuildBadgeInput): BadgePrintPayload {
  const childName = `${input.childFirstName} ${input.childLastName}`.trim();
  const lines: BadgePrintLine[] = [];

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

  for (const field of input.settings.customFields) {
    lines.push({
      kind: "custom",
      text: field.text,
      label: field.label || undefined,
    });
  }

  const base = getPublicAppBaseUrl();
  const ticketUrl =
    input.checkInToken && input.settings.showQrCode
      ? registrationTicketUrl(input.checkInToken, base)
      : null;

  return {
    registrationId: input.registrationId,
    settings: input.settings,
    lines,
    childName,
    qrDataUrl: input.qrDataUrl ?? null,
    ticketUrl,
  };
}

export function sampleBadgePreviewPayload(
  settings: ResolvedBadgePrintSettings,
): BadgePrintPayload {
  return buildBadgePrintPayload({
    settings,
    registrationId: "preview",
    childFirstName: "Alex",
    childLastName: "Rivera",
    allergiesNotes: settings.showAllergyFlag ? "Peanuts" : null,
    registrationNumber: settings.showRegistrationNumber ? "VBS-2026-001" : null,
    checkInToken: settings.showQrCode ? "preview-token" : null,
    seasonName: "Summer VBS",
    seasonYear: 2026,
    classroomName: "Explorers",
    badgeDisplayName: settings.showBadgeDisplayName ? "Explorers" : null,
    checkInLabel: settings.showCheckInLabel ? "Room B12" : null,
    qrDataUrl: settings.showQrCode
      ? "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'%3E%3Crect width='120' height='120' fill='%23fff'/%3E%3Ctext x='60' y='64' text-anchor='middle' font-size='12' fill='%2364748b'%3EQR%3C/text%3E%3C/svg%3E"
      : null,
  });
}
