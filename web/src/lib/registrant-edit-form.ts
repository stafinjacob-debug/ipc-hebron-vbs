import type { FormDefinitionV1, FormFieldDef } from "@/lib/registration-form-definition";
import { formIncludesChildDateOfBirth } from "@/lib/registration-form-definition";
import type { PublicRegistrationFieldRules } from "@/lib/public-registration";
import { validateFieldValue } from "@/lib/registration-form-validate";

export type RegistrantEditChildValues = {
  registrationId: string;
  values: Record<string, string>;
};

function stringifyStoredValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "true" : "";
  if (typeof value === "number") return String(value);
  return String(value);
}

export function isRegistrantFieldVisible(field: FormFieldDef, ctx: Record<string, string>): boolean {
  if (!field.showWhen) return true;
  return (ctx[field.showWhen.fieldKey] ?? "") === field.showWhen.equals;
}

export function buildGuardianFieldValues(args: {
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  guardianResponses: Record<string, unknown> | null | undefined;
}): Record<string, string> {
  const values: Record<string, string> = {
    guardianFirstName: args.firstName,
    guardianLastName: args.lastName,
    guardianEmail: args.email ?? "",
    guardianPhone: args.phone ?? "",
  };
  for (const [key, raw] of Object.entries(args.guardianResponses ?? {})) {
    values[key] = stringifyStoredValue(raw);
  }
  return values;
}

export function buildChildFieldValues(args: {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  allergiesNotes: string | null;
  customResponses: Record<string, unknown> | null | undefined;
}): Record<string, string> {
  const values: Record<string, string> = {
    childFirstName: args.firstName,
    childLastName: args.lastName,
    childDateOfBirth: args.dateOfBirth,
    allergiesNotes: args.allergiesNotes ?? "",
  };
  for (const [key, raw] of Object.entries(args.customResponses ?? {})) {
    values[key] = stringifyStoredValue(raw);
  }
  return values;
}

function getFormValue(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v : "";
}

export type RegistrantEditParseResult =
  | {
      ok: true;
      guardian: {
        guardianFirstName: string;
        guardianLastName: string;
        guardianEmail?: string;
        guardianPhone?: string;
      };
      guardianCustom: Record<string, string | boolean | number | null>;
      children: Array<{
        registrationId: string;
        childFirstName: string;
        childLastName: string;
        childDateOfBirth: string;
        allergiesNotes: string | null;
        custom: Record<string, string | boolean | number | null>;
      }>;
    }
  | { ok: false; message: string };

export function parseRegistrantEditForm(
  formData: FormData,
  def: FormDefinitionV1,
  registrationIds: string[],
  rules: PublicRegistrationFieldRules,
): RegistrantEditParseResult {
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
    if (!isRegistrantFieldVisible(f, guardianCtx)) continue;
    const err = validateFieldValue(f, guardianCtx[f.key] ?? "");
    if (err) return { ok: false, message: err };
  }

  if (rules.requireGuardianEmail && !guardianCtx.guardianEmail?.trim()) {
    return { ok: false, message: "Email is required." };
  }
  if (rules.requireGuardianPhone && !guardianCtx.guardianPhone?.trim()) {
    return { ok: false, message: "Phone is required." };
  }

  const guardian = {
    guardianFirstName: guardianCtx.guardianFirstName?.trim() ?? "",
    guardianLastName: guardianCtx.guardianLastName?.trim() ?? "",
    guardianEmail: guardianCtx.guardianEmail?.trim() || undefined,
    guardianPhone: guardianCtx.guardianPhone?.trim() || undefined,
  };
  if (!guardian.guardianFirstName || !guardian.guardianLastName) {
    return { ok: false, message: "Guardian first and last name are required." };
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
    if (!isRegistrantFieldVisible(f, guardianCtx)) continue;
    const raw = guardianCtx[f.key] ?? "";
    if (f.type === "checkbox" || f.type === "boolean") {
      guardianCustom[f.key] = raw === "true" || raw === "on";
    } else {
      guardianCustom[f.key] = raw || null;
    }
  }

  const parsedChildren: Extract<RegistrantEditParseResult, { ok: true }>["children"] = [];

  for (const registrationId of registrationIds) {
    const ctx: Record<string, string> = {};
    for (const f of childFields) {
      if (f.type === "sectionHeader" || f.type === "staticText") continue;
      ctx[f.key] = getFormValue(formData, `${f.key}__${registrationId}`);
    }

    for (const f of childFields) {
      if (f.type === "sectionHeader" || f.type === "staticText") continue;
      if (!isRegistrantFieldVisible(f, ctx)) continue;
      const err = validateFieldValue(f, ctx[f.key] ?? "");
      if (err) return { ok: false, message: err };
    }

    const allergiesNotesRaw = ctx.allergiesNotes?.trim() ?? "";
    if (rules.requireAllergiesNotes && !allergiesNotesRaw) {
      return { ok: false, message: "Please note allergies or enter “None” for each child." };
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
      if (!isRegistrantFieldVisible(f, ctx)) continue;
      const raw = ctx[f.key] ?? "";
      if (f.type === "checkbox" || f.type === "boolean") {
        custom[f.key] = raw === "true" || raw === "on";
      } else {
        custom[f.key] = raw || null;
      }
    }

    const requiresDob = formIncludesChildDateOfBirth(def);
    if (
      !ctx.childFirstName?.trim() ||
      !ctx.childLastName?.trim() ||
      (requiresDob && !ctx.childDateOfBirth?.trim())
    ) {
      return {
        ok: false,
        message: requiresDob
          ? "Each child needs a name and date of birth."
          : "Each child needs a first and last name.",
      };
    }

    parsedChildren.push({
      registrationId,
      childFirstName: ctx.childFirstName.trim(),
      childLastName: ctx.childLastName.trim(),
      childDateOfBirth: ctx.childDateOfBirth,
      allergiesNotes: allergiesNotesRaw || null,
      custom,
    });
  }

  return { ok: true, guardian, guardianCustom, children: parsedChildren };
}

export function registrantEditFieldName(fieldKey: string, registrationId?: string): string {
  return registrationId ? `${fieldKey}__${registrationId}` : fieldKey;
}
