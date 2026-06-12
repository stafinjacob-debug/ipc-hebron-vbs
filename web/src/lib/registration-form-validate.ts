import type { FormDefinitionV1, FormFieldDef } from "@/lib/registration-form-definition";

export type GuardianExtract = {
  guardianFirstName: string;
  guardianLastName: string;
  guardianEmail?: string;
  guardianPhone?: string;
};

function guardianSectionFields(def: FormDefinitionV1): FormFieldDef[] {
  return def.fields.filter((f) => {
    const sec = def.sections.find((s) => s.id === f.sectionId);
    return sec?.audience === "guardian" || sec?.audience === "consent";
  });
}

function isFillableField(field: FormFieldDef): boolean {
  return field.type !== "sectionHeader" && field.type !== "staticText";
}

export function fieldMatchesEmail(field: FormFieldDef): boolean {
  if (field.type === "email") return true;
  const key = field.key.toLowerCase();
  const label = (field.label ?? "").toLowerCase();
  return key.includes("email") || label.includes("email");
}

export function fieldMatchesPhone(field: FormFieldDef): boolean {
  if (field.type === "tel") return true;
  const key = field.key.toLowerCase();
  const label = (field.label ?? "").toLowerCase();
  return (
    key.includes("phone") ||
    key.includes("contact") ||
    key.includes("mobile") ||
    label.includes("phone") ||
    label.includes("contact number") ||
    label.includes("mobile")
  );
}

function fieldMatchesFullName(field: FormFieldDef): boolean {
  const key = field.key.toLowerCase();
  const label = (field.label ?? "").toLowerCase();
  if (key === "pname") return true;
  if (label.includes("full name")) return true;
  if (label.includes("name") && !label.includes("first") && !label.includes("last") && !label.includes("email")) {
    return true;
  }
  return false;
}

function firstMatchingFieldKey(
  def: FormDefinitionV1,
  matches: (field: FormFieldDef) => boolean,
  fallback: string,
): string {
  const hit = guardianSectionFields(def).find((f) => isFillableField(f) && matches(f));
  return hit?.key ?? fallback;
}

/** Map builder-defined guardian fields onto canonical guardian contact columns. */
export function resolveGuardianContactFromForm(
  def: FormDefinitionV1,
  guardianCtx: Record<string, string>,
): GuardianExtract {
  const fields = guardianSectionFields(def);

  let guardianEmail = guardianCtx.guardianEmail?.trim() || undefined;
  if (!guardianEmail) {
    for (const f of fields) {
      if (!isFillableField(f) || !isVisible(f, guardianCtx) || !fieldMatchesEmail(f)) continue;
      const v = guardianCtx[f.key]?.trim();
      if (v) {
        guardianEmail = v;
        break;
      }
    }
  }

  let guardianPhone = guardianCtx.guardianPhone?.trim() || undefined;
  if (!guardianPhone) {
    for (const f of fields) {
      if (!isFillableField(f) || !isVisible(f, guardianCtx) || !fieldMatchesPhone(f)) continue;
      const v = guardianCtx[f.key]?.trim();
      if (v) {
        guardianPhone = v;
        break;
      }
    }
  }

  let guardianFirstName = guardianCtx.guardianFirstName?.trim() ?? "";
  let guardianLastName = guardianCtx.guardianLastName?.trim() ?? "";
  if (!guardianFirstName || !guardianLastName) {
    for (const f of fields) {
      if (!isFillableField(f) || !isVisible(f, guardianCtx) || !fieldMatchesFullName(f)) continue;
      const full = guardianCtx[f.key]?.trim() ?? "";
      if (!full) continue;
      const parts = full.split(/\s+/).filter(Boolean);
      if (parts.length >= 2) {
        guardianFirstName = parts[0]!;
        guardianLastName = parts.slice(1).join(" ");
      } else {
        guardianFirstName = full;
        guardianLastName = full;
      }
      break;
    }
  }

  return { guardianFirstName, guardianLastName, guardianEmail, guardianPhone };
}

export function formIncludesGuardianEmailField(def: FormDefinitionV1): boolean {
  return guardianSectionFields(def).some((f) => isFillableField(f) && fieldMatchesEmail(f));
}

export function formIncludesGuardianPhoneField(def: FormDefinitionV1): boolean {
  return guardianSectionFields(def).some((f) => isFillableField(f) && fieldMatchesPhone(f));
}

export type ChildExtract = {
  childFirstName: string;
  childLastName: string;
  childDateOfBirth: string;
  allergiesNotes?: string | null;
  custom: Record<string, string | boolean | number | null>;
};

export type DynamicSubmitParse =
  | {
      ok: true;
      guardian: GuardianExtract;
      children: ChildExtract[];
      guardianCustom: Record<string, string | boolean | number | null>;
    }
  | { ok: false; message: string; fieldKey?: string };

function getFormValue(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v : "";
}

function isVisible(field: FormFieldDef, ctx: Record<string, string>): boolean {
  if (!field.showWhen) return true;
  const cur = ctx[field.showWhen.fieldKey] ?? "";
  return cur === field.showWhen.equals;
}

/**
 * Builds guardian / custom / child shapes for conditional Stripe skip, using the same
 * visibility and key routing as {@link parseDynamicRegistrationForm} (without validating).
 */
export function extractStripeSkipEvaluationData(
  def: FormDefinitionV1,
  guardianCtx: Record<string, string>,
  childRows: Array<Record<string, string>>,
): {
  guardian: GuardianExtract;
  guardianCustom: Record<string, string | boolean | number | null>;
  children: ChildExtract[];
} {
  const guardianFields = def.fields.filter((f) => {
    const sec = def.sections.find((s) => s.id === f.sectionId);
    return sec?.audience === "guardian" || sec?.audience === "consent";
  });
  const childFields = def.fields.filter((f) => {
    const sec = def.sections.find((s) => s.id === f.sectionId);
    return sec?.audience === "eachChild";
  });

  const guardian: GuardianExtract = resolveGuardianContactFromForm(def, guardianCtx);

  const guardianCustom: Record<string, string | boolean | number | null> = {};
  for (const f of guardianFields) {
    if (f.type === "sectionHeader" || f.type === "staticText") continue;
    if (
      f.key === "guardianFirstName" ||
      f.key === "guardianLastName" ||
      f.key === "guardianEmail" ||
      f.key === "guardianPhone"
    ) {
      continue;
    }
    if (!isVisible(f, guardianCtx)) continue;
    const raw = guardianCtx[f.key] ?? "";
    guardianCustom[f.key] = raw || null;
  }

  const children: ChildExtract[] = [];
  for (let i = 0; i < childRows.length; i++) {
    const ctx = childRows[i] ?? {};
    const allergiesNotesRaw = ctx.allergiesNotes?.trim() ?? "";
    const custom: Record<string, string | boolean | number | null> = {};
    for (const f of childFields) {
      if (f.type === "sectionHeader" || f.type === "staticText") continue;
      if (
        f.key === "childFirstName" ||
        f.key === "childLastName" ||
        f.key === "childDateOfBirth" ||
        f.key === "allergiesNotes"
      ) {
        continue;
      }
      if (!isVisible(f, ctx)) continue;
      custom[f.key] = ctx[f.key] || null;
    }
    children.push({
      childFirstName: ctx.childFirstName?.trim() ?? "",
      childLastName: ctx.childLastName?.trim() ?? "",
      childDateOfBirth: ctx.childDateOfBirth ?? "",
      allergiesNotes: allergiesNotesRaw ? allergiesNotesRaw : null,
      custom,
    });
  }

  return { guardian, guardianCustom, children };
}

export function validateFieldValue(field: FormFieldDef, raw: string): string | null {
  const v = raw.trim();
  if (field.type === "checkbox" || field.type === "boolean") {
    const checked = v === "true" || v === "on";
    if (field.required && !checked) return `${field.label} is required.`;
    if (!checked) return null;
    return null;
  }
  if (field.required && !v) {
    return `${field.label} is required.`;
  }
  if (!v && !field.required) return null;

  switch (field.type) {
    case "email":
      if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return "Enter a valid email.";
      break;
    case "date":
      if (v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) return "Use a valid date.";
      break;
    case "number": {
      if (!v) break;
      const n = Number(v);
      if (Number.isNaN(n)) return "Enter a valid number.";
      if (field.validation?.min != null && n < field.validation.min) return `Must be at least ${field.validation.min}.`;
      if (field.validation?.max != null && n > field.validation.max) return `Must be at most ${field.validation.max}.`;
      break;
    }
    default:
      break;
  }

  if (fieldMatchesEmail(field) && field.type !== "email" && v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
    return "Enter a valid email.";
  }

  if (field.validation?.minLength != null && v.length < field.validation.minLength) {
    return `At least ${field.validation.minLength} characters.`;
  }
  if (field.validation?.maxLength != null && v.length > field.validation.maxLength) {
    return `At most ${field.validation.maxLength} characters.`;
  }
  if (field.validation?.pattern && v) {
    try {
      const re = new RegExp(field.validation.pattern);
      if (!re.test(v)) return "Invalid format.";
    } catch {
      /* ignore bad pattern */
    }
  }

  if (field.type === "select" || field.type === "radio") {
    if (v && field.options && !field.options.some((o) => o.value === v)) return "Invalid choice.";
  }

  return null;
}

/**
 * Parse multi-child dynamic registration from FormData.
 * Expects keys: childCount, and per index i: fieldKey__i or for guardian fields without suffix.
 */
export function parseDynamicRegistrationForm(
  formData: FormData,
  def: FormDefinitionV1,
  rules: { requireGuardianEmail: boolean; requireGuardianPhone: boolean; requireAllergiesNotes: boolean },
): DynamicSubmitParse {
  const guardianFields = def.fields.filter((f) => {
    const sec = def.sections.find((s) => s.id === f.sectionId);
    return sec?.audience === "guardian" || sec?.audience === "consent";
  });

  const childFields = def.fields.filter((f) => {
    const sec = def.sections.find((s) => s.id === f.sectionId);
    return sec?.audience === "eachChild";
  });

  const guardianCtx: Record<string, string> = {};
  for (const f of guardianFields) {
    if (f.type === "sectionHeader" || f.type === "staticText") continue;
    guardianCtx[f.key] = getFormValue(formData, f.key);
  }

  for (const f of guardianFields) {
    if (f.type === "sectionHeader" || f.type === "staticText") continue;
    if (!isVisible(f, guardianCtx)) continue;
    const err = validateFieldValue(f, guardianCtx[f.key] ?? "");
    if (err) return { ok: false, message: err, fieldKey: f.key };
  }

  const guardian = resolveGuardianContactFromForm(def, guardianCtx);

  if (rules.requireGuardianEmail && !guardian.guardianEmail && formIncludesGuardianEmailField(def)) {
    return {
      ok: false,
      message: "Email is required for this program.",
      fieldKey: firstMatchingFieldKey(def, fieldMatchesEmail, "guardianEmail"),
    };
  }
  if (rules.requireGuardianPhone && !guardian.guardianPhone && formIncludesGuardianPhoneField(def)) {
    return {
      ok: false,
      message: "Phone is required for this program.",
      fieldKey: firstMatchingFieldKey(def, fieldMatchesPhone, "guardianPhone"),
    };
  }

  if (!guardian.guardianFirstName || !guardian.guardianLastName) {
    return { ok: false, message: "Contact name is required." };
  }

  const guardianCustom: Record<string, string | boolean | number | null> = {};
  for (const f of guardianFields) {
    if (f.type === "sectionHeader" || f.type === "staticText") continue;
    if (
      f.key === "guardianFirstName" ||
      f.key === "guardianLastName" ||
      f.key === "guardianEmail" ||
      f.key === "guardianPhone"
    ) {
      continue;
    }
    if (!isVisible(f, guardianCtx)) continue;
    const raw = guardianCtx[f.key] ?? "";
    guardianCustom[f.key] = raw || null;
  }

  const countRaw = getFormValue(formData, "childCount");
  const childCount = Math.min(8, Math.max(1, parseInt(countRaw, 10) || 1));

  const children: ChildExtract[] = [];

  for (let i = 0; i < childCount; i++) {
    const ctx: Record<string, string> = {};
    for (const f of childFields) {
      if (f.type === "sectionHeader" || f.type === "staticText") continue;
      ctx[f.key] = getFormValue(formData, `${f.key}__${i}`);
    }

    for (const f of childFields) {
      if (f.type === "sectionHeader" || f.type === "staticText") continue;
      if (!isVisible(f, ctx)) continue;
      const err = validateFieldValue(f, ctx[f.key] ?? "");
      if (err) return { ok: false, message: `Child ${i + 1}: ${err}`, fieldKey: `${f.key}__${i}` };
    }

    const allergiesNotesRaw = ctx.allergiesNotes?.trim() ?? "";
    if (rules.requireAllergiesNotes && !allergiesNotesRaw) {
      return {
        ok: false,
        message: `Child ${i + 1}: Please note allergies or enter “None”.`,
        fieldKey: `allergiesNotes__${i}`,
      };
    }

    const custom: Record<string, string | boolean | number | null> = {};
    for (const f of childFields) {
      if (f.type === "sectionHeader" || f.type === "staticText") continue;
      if (
        f.key === "childFirstName" ||
        f.key === "childLastName" ||
        f.key === "childDateOfBirth" ||
        f.key === "allergiesNotes"
      ) {
        continue;
      }
      if (!isVisible(f, ctx)) continue;
      custom[f.key] = ctx[f.key] || null;
    }

    children.push({
      childFirstName: ctx.childFirstName?.trim() ?? "",
      childLastName: ctx.childLastName?.trim() ?? "",
      childDateOfBirth: ctx.childDateOfBirth ?? "",
      allergiesNotes: allergiesNotesRaw ? allergiesNotesRaw : null,
      custom,
    });
  }

  if (children.some((c) => !c.childFirstName || !c.childLastName || !c.childDateOfBirth)) {
    return { ok: false, message: "Each child needs a name and date of birth." };
  }

  return { ok: true, guardian, children, guardianCustom };
}
