import type { FormDefinitionV1, FormFieldDef } from "@/lib/registration-form-definition";

export type GuardianExtract = {
  guardianFirstName: string;
  guardianLastName: string;
  guardianEmail?: string;
  guardianPhone?: string;
};

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

function validateFieldValue(field: FormFieldDef, raw: string): string | null {
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

  if (rules.requireGuardianEmail && !guardianCtx.guardianEmail?.trim()) {
    return { ok: false, message: "Email is required for this program.", fieldKey: "guardianEmail" };
  }
  if (rules.requireGuardianPhone && !guardianCtx.guardianPhone?.trim()) {
    return { ok: false, message: "Phone is required for this program.", fieldKey: "guardianPhone" };
  }

  const guardian: GuardianExtract = {
    guardianFirstName: guardianCtx.guardianFirstName?.trim() ?? "",
    guardianLastName: guardianCtx.guardianLastName?.trim() ?? "",
    guardianEmail: guardianCtx.guardianEmail?.trim() || undefined,
    guardianPhone: guardianCtx.guardianPhone?.trim() || undefined,
  };

  if (!guardian.guardianFirstName || !guardian.guardianLastName) {
    return { ok: false, message: "Guardian name is required." };
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
