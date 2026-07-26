import { jsonToStringArray } from "@/lib/class-form-field-match";

function normalizeConditionalValue(v: unknown): string {
  if (v == null) return "";
  return String(v).trim().toLowerCase();
}

export type StripeConditionalFieldContext = {
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
};

/**
 * When pay later is enabled and an auto field key is configured, force pay later if any
 * guardian/child field matches one of the allowed values (or any non-empty value when the
 * allow-list is empty).
 */
export function shouldAutoPayLaterForSubmission(args: {
  autoFieldKey: string | null | undefined;
  autoFieldValues: unknown;
  ctx: StripeConditionalFieldContext;
}): boolean {
  const fieldKey = args.autoFieldKey?.trim() ?? "";
  if (!fieldKey) return false;

  const allowed = jsonToStringArray(args.autoFieldValues)
    .map((s) => normalizeConditionalValue(s))
    .filter(Boolean);
  const anyNonEmpty = allowed.length === 0;

  const matches = (raw: unknown): boolean => {
    const cur = normalizeConditionalValue(raw);
    if (!cur) return false;
    if (anyNonEmpty) return true;
    return allowed.includes(cur);
  };

  const guardianKnown: Record<string, string | undefined> = {
    guardianFirstName: args.ctx.guardian.guardianFirstName,
    guardianLastName: args.ctx.guardian.guardianLastName,
    guardianEmail: args.ctx.guardian.guardianEmail,
    guardianPhone: args.ctx.guardian.guardianPhone,
  };

  if (matches(guardianKnown[fieldKey])) return true;
  if (matches(args.ctx.guardianCustom[fieldKey])) return true;

  for (const child of args.ctx.children) {
    const childKnown: Record<string, string | null | undefined> = {
      childFirstName: child.childFirstName,
      childLastName: child.childLastName,
      childDateOfBirth: child.childDateOfBirth,
      allergiesNotes: child.allergiesNotes ?? null,
    };
    if (matches(childKnown[fieldKey])) return true;
    if (matches(child.custom[fieldKey])) return true;
  }
  return false;
}

/** True when auto pay-later is configured (hides the pay-later radio on the public form). */
export function stripeAutoPayLaterConfigured(autoFieldKey: string | null | undefined): boolean {
  return Boolean(autoFieldKey?.trim());
}
