/** Shared VBS horizontal check-in badge field labels and spacing. */

export const VBS_BADGE_FIELD_LABELS = {
  class: "Class:",
  tShirtSize: "T-Shirt Size:",
  guardianName: "Guardian Name:",
  guardianNumber: "Guardian Number:",
  allergies: "Allergies:",
} as const;

/** Extra line spacing multipliers on top of typography lineGapIn. */
export const VBS_BADGE_SPACING = {
  afterName: 1,
  afterDivider: 1,
  afterEvent: 2,
  afterClass: 2,
  afterTShirt: 3,
  afterGuardianName: 0.5,
  afterGuardianNumber: 2,
  afterAllergies: 0,
  rightRegToQr: 1.2,
  rightQrToTime: 1,
} as const;

export function vbsLabeledLine(label: string, value: string): { label: string; value: string } {
  const trimmedLabel = label.endsWith(":") ? label : `${label}:`;
  return { label: trimmedLabel, value: value.trim() };
}
