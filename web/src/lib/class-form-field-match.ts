/**
 * Normalize values from registration custom fields (and merged child context) for class matching.
 */
export function normalizeSubmittedFieldValue(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return String(v).trim();
}

export function jsonToStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string");
}

export function customResponsesAsRecord(json: unknown): Record<string, unknown> {
  if (json && typeof json === "object" && !Array.isArray(json)) {
    return json as Record<string, unknown>;
  }
  return {};
}

export function coerceJsonLeaf(v: unknown): string | boolean | number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "string" || typeof v === "boolean" || typeof v === "number") return v;
  return null;
}

/** Whether the child's submitted value for `fieldKey` is one of `allowedRaw` (case-insensitive). */
export function fieldValueMatchesAllowed(
  ctx: Record<string, string | boolean | number | null>,
  fieldKey: string,
  allowedRaw: string[],
): boolean {
  const allowed = allowedRaw
    .map((s) => normalizeSubmittedFieldValue(s).toLowerCase())
    .filter(Boolean);
  if (allowed.length === 0) return true;
  const cur = normalizeSubmittedFieldValue(ctx[fieldKey]).toLowerCase();
  if (!cur) return false;
  return allowed.includes(cur);
}

export function parseMatchFieldValuesFromForm(text: string): string[] {
  return text
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}
