/**
 * Pure helpers for class-placement gating (safe for Client Components).
 * Do not import Prisma or class-assignment from this file.
 */

export type ClassPlacementChildInput = {
  childFirstName: string;
  childLastName: string;
  childDateOfBirth: string;
  custom?: Record<string, string | boolean | number | null>;
};

export type ClassPlacementPreviewRow = {
  index: number;
  label: string;
  canPlace: boolean;
};

export function formatClassPlacementBlockMessage(args: {
  unplaced: ClassPlacementPreviewRow[];
  helpContact: string;
}): string {
  const names = args.unplaced.map((r) => r.label);
  const who =
    names.length === 1
      ? names[0]
      : names.length === 2
        ? `${names[0]} and ${names[1]}`
        : `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;

  const spotWord = names.length === 1 ? "spot is" : "spots are";
  return `There ${spotWord} no class grouping available for ${who} based on our program rules. Please contact ${args.helpContact} to see if spots open up.`;
}

export function resolveRegistrationHelpContact(args: {
  helpContactEmail?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  churchDisplayName?: string;
}): string {
  const email = args.helpContactEmail?.trim() || args.contactEmail?.trim();
  const phone = args.contactPhone?.trim();
  if (email && phone) return `${email} or ${phone}`;
  if (email) return email;
  if (phone) return phone;
  return args.churchDisplayName ? `the ${args.churchDisplayName} office` : "the church office";
}

/** When waitlist is off, block submit if auto-assignment would leave a child unplaced. */
export function shouldBlockRegistrationWithoutClassPlacement(args: {
  classroomsEnabled: boolean;
  waitlistEnabled: boolean;
}): boolean {
  return args.classroomsEnabled && !args.waitlistEnabled;
}
