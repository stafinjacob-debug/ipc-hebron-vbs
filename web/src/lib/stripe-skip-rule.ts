function normalizeConditionalValue(v: unknown): string {
  if (v == null) return "";
  return String(v).trim().toLowerCase();
}

/**
 * When Stripe checkout is enabled, optionally skip payment if a guardian or child field
 * matches the configured value (same logic as public registration submit).
 */
export function shouldSkipStripeForSubmission(args: {
  skipFieldKey: string | null;
  skipFieldValue: string | null;
  guardian: {
    guardianFirstName: string;
    guardianLastName: string;
    guardianEmail?: string;
    guardianPhone?: string;
  };
  guardianCustom: Record<string, string | boolean | number | null>;
  children: Array<{
    childFirstName: string;
    childLastName: string;
    childDateOfBirth: string;
    allergiesNotes?: string | null;
    custom: Record<string, string | boolean | number | null>;
  }>;
}): boolean {
  const fieldKey = args.skipFieldKey?.trim() ?? "";
  const wanted = normalizeConditionalValue(args.skipFieldValue);
  if (!fieldKey || !wanted) return false;

  const guardianKnown: Record<string, string | undefined> = {
    guardianFirstName: args.guardian.guardianFirstName,
    guardianLastName: args.guardian.guardianLastName,
    guardianEmail: args.guardian.guardianEmail,
    guardianPhone: args.guardian.guardianPhone,
  };

  if (normalizeConditionalValue(guardianKnown[fieldKey]) === wanted) return true;
  if (normalizeConditionalValue(args.guardianCustom[fieldKey]) === wanted) return true;

  for (const child of args.children) {
    const childKnown: Record<string, string | null | undefined> = {
      childFirstName: child.childFirstName,
      childLastName: child.childLastName,
      childDateOfBirth: child.childDateOfBirth,
      allergiesNotes: child.allergiesNotes ?? null,
    };
    if (normalizeConditionalValue(childKnown[fieldKey]) === wanted) return true;
    if (normalizeConditionalValue(child.custom[fieldKey]) === wanted) return true;
  }
  return false;
}
