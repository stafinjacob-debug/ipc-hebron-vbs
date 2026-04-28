import { customResponsesAsRecord } from "@/lib/class-form-field-match";
import type { FormDefinitionV1, FormFieldDef } from "@/lib/registration-form-definition";
import { allowedWaiverMergeFieldKeys, parseWaiverMergeFieldKeysFromDb } from "@/lib/waiver-merge-fields";

function sectionAudience(def: FormDefinitionV1, field: FormFieldDef): string | undefined {
  return def.sections.find((s) => s.id === field.sectionId)?.audience;
}

/** Resolve a field from published or draft definition (draft may have keys staff just added). */
function findFieldInDefs(
  key: string,
  defPublished: FormDefinitionV1 | null,
  defDraft: FormDefinitionV1 | null,
): { def: FormDefinitionV1; field: FormFieldDef } | null {
  for (const def of [defPublished, defDraft]) {
    if (!def) continue;
    const field = def.fields.find((f) => f.key === key);
    if (field) return { def, field };
  }
  return null;
}

/** Keep admin order; allow keys present in either published or draft form. */
function orderedPickerKeys(
  fieldKeysFromDb: unknown,
  defPublished: FormDefinitionV1 | null,
  defDraft: FormDefinitionV1 | null,
): string[] {
  const parsed = parseWaiverMergeFieldKeysFromDb(fieldKeysFromDb);
  const allowed = new Set<string>();
  if (defPublished) for (const k of allowedWaiverMergeFieldKeys(defPublished)) allowed.add(k);
  if (defDraft) for (const k of allowedWaiverMergeFieldKeys(defDraft)) allowed.add(k);
  // Still require key to exist in at least one def (union above).
  return parsed.filter((k) => allowed.has(k));
}

function guardianRawMap(opts: {
  guardian: { firstName: string; lastName: string; email: string | null; phone: string | null };
  guardianResponses: unknown;
}): Record<string, unknown> {
  const base =
    opts.guardianResponses && typeof opts.guardianResponses === "object" && !Array.isArray(opts.guardianResponses)
      ? { ...(opts.guardianResponses as Record<string, unknown>) }
      : {};
  base.guardianFirstName = opts.guardian.firstName;
  base.guardianLastName = opts.guardian.lastName;
  base.guardianEmail = opts.guardian.email ?? "";
  base.guardianPhone = opts.guardian.phone ?? "";
  return base;
}

function childRawMap(opts: {
  child: {
    firstName: string;
    lastName: string;
    dateOfBirth: Date;
    allergiesNotes: string | null;
  };
  customResponses: unknown;
}): Record<string, unknown> {
  const base = customResponsesAsRecord(opts.customResponses);
  base.childFirstName = opts.child.firstName;
  base.childLastName = opts.child.lastName;
  base.childDateOfBirth = opts.child.dateOfBirth.toISOString().slice(0, 10);
  base.allergiesNotes = opts.child.allergiesNotes ?? "";
  return base;
}

function formatPickerValue(raw: unknown, valueMax = 72): string {
  if (raw === null || raw === undefined) return "—";
  if (typeof raw === "boolean") return raw ? "Yes" : "No";
  if (typeof raw === "number" && Number.isFinite(raw)) return String(raw);
  if (typeof raw === "string") {
    const t = raw.trim();
    if (!t) return "—";
    return t.length > valueMax ? `${t.slice(0, valueMax - 1)}…` : t;
  }
  if (typeof raw === "object") {
    try {
      const s = JSON.stringify(raw);
      return s.length > valueMax ? `${s.slice(0, valueMax - 1)}…` : s;
    } catch {
      return "—";
    }
  }
  return String(raw);
}

/**
 * Short line for the class “Add unassigned” dropdown: selected form labels + values, plus optional age.
 * Uses **published and draft** definitions so keys saved while editing the draft still resolve.
 */
export function buildUnassignedClassPickerPreview(opts: {
  defPublished: FormDefinitionV1 | null;
  defDraft?: FormDefinitionV1 | null;
  fieldKeysFromDb: unknown;
  guardian: { firstName: string; lastName: string; email: string | null; phone: string | null };
  guardianResponses: unknown;
  child: {
    firstName: string;
    lastName: string;
    dateOfBirth: Date;
    allergiesNotes: string | null;
  };
  customResponses: unknown;
  /** Whole years, same helper as roster (optional). */
  ageWholeYears: number | null;
  maxLength?: number;
}): string {
  const maxLen = opts.maxLength ?? 260;
  const pub = opts.defPublished;
  const draft = opts.defDraft ?? null;
  const keys = orderedPickerKeys(opts.fieldKeysFromDb, pub, draft);
  const gRaw = guardianRawMap({ guardian: opts.guardian, guardianResponses: opts.guardianResponses });
  const cRaw = childRawMap({ child: opts.child, customResponses: opts.customResponses });

  const parts: string[] = [];
  for (const key of keys) {
    const found = findFieldInDefs(key, pub, draft);
    if (!found) continue;
    const { def, field } = found;
    const aud = sectionAudience(def, field);
    const raw =
      aud === "guardian" || aud === "consent" ? gRaw[key] : aud === "eachChild" ? cRaw[key] : undefined;
    const v = formatPickerValue(raw);
    const label = field.label?.trim() || key;
    parts.push(`${label}: ${v}`);
  }
  if (opts.ageWholeYears != null) {
    parts.push(`Age ~${opts.ageWholeYears}`);
  }
  const joined = parts.join(" · ");
  if (joined.length <= maxLen) return joined;
  return `${joined.slice(0, Math.max(0, maxLen - 1))}…`;
}
