/** Shared VBS horizontal check-in badge field labels and spacing. */

export const VBS_BADGE_FIELD_LABELS = {
  class: "Class:",
  tShirtSize: "T-Shirt Size:",
  guardianName: "Guardian Name:",
  guardianNumber: "Guardian Number:",
  allergies: "Allergies:",
} as const;

/** Fixed vertical gaps in points (pt). Generic "space" uses lineGapIn from typography. */
export const VBS_BADGE_GAP_PT = {
  afterName: 4,
  lineBlock: 6,
  afterDivider: 4,
  beforeAllergies: 4,
} as const;

/** Convert typography lineGapIn (inches) to one or two generic line spaces in pt. */
export function vbsLineGapPt(lineGapIn: number, spaces = 1): number {
  return lineGapIn * 72 * spaces;
}

export function vbsLabeledLine(label: string, value: string): { label: string; value: string } {
  const trimmedLabel = label.endsWith(":") ? label : `${label}:`;
  return { label: trimmedLabel, value: value.trim() };
}
