import type { FormDefinitionV1, FormFieldDef } from "@/lib/registration-form-definition";
import type { ChildExtract, GuardianExtract } from "@/lib/registration-form-validate";

export type WaiverSupplementalFieldDef = { key: string; label: string; required: boolean };

export type WaiverPdfMergeRow = { label: string; value: string };

export function parseWaiverMergeFieldKeysFromDb(json: unknown): string[] {
  if (!Array.isArray(json)) return [];
  return json.filter((k): k is string => typeof k === "string" && /^[a-zA-Z][a-zA-Z0-9_]*$/.test(k));
}

/** Normalize admin-configured supplemental rows before save. */
export function sanitizeWaiverSupplementalFieldsForSave(
  rows: WaiverSupplementalFieldDef[] | null | undefined,
): WaiverSupplementalFieldDef[] {
  if (!rows?.length) return [];
  const out: WaiverSupplementalFieldDef[] = [];
  for (const r of rows) {
    const label = (r.label ?? "").trim().slice(0, 200);
    const key = (r.key ?? "").trim();
    if (!label || !/^w_supp_[a-zA-Z0-9_]+$/.test(key)) continue;
    out.push({ key, label, required: Boolean(r.required) });
  }
  return out.slice(0, 12);
}

export function parseWaiverSupplementalDefsFromDb(json: unknown): WaiverSupplementalFieldDef[] {
  if (!Array.isArray(json)) return [];
  const out: WaiverSupplementalFieldDef[] = [];
  for (const row of json) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const key = typeof o.key === "string" ? o.key.trim() : "";
    const label = typeof o.label === "string" ? o.label.trim() : "";
    if (!/^w_supp_[a-zA-Z0-9_]+$/.test(key) || !label) continue;
    out.push({ key, label, required: Boolean(o.required) });
  }
  return out.slice(0, 12);
}

function fieldByKey(def: FormDefinitionV1, key: string): FormFieldDef | undefined {
  return def.fields.find((f) => f.key === key);
}

function sectionAudience(def: FormDefinitionV1, field: FormFieldDef): string | undefined {
  return def.sections.find((s) => s.id === field.sectionId)?.audience;
}

function formatMergeValue(v: string | boolean | number | null | undefined): string {
  if (v === "" || v == null) return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v);
}

/** Allowed merge keys: non-static fields on guardian, consent, or eachChild sections. */
export function allowedWaiverMergeFieldKeys(def: FormDefinitionV1): Set<string> {
  const keys = new Set<string>();
  for (const f of def.fields) {
    if (f.type === "sectionHeader" || f.type === "staticText") continue;
    const aud = sectionAudience(def, f);
    if (aud === "guardian" || aud === "consent" || aud === "eachChild") keys.add(f.key);
  }
  return keys;
}

export function filterWaiverMergeKeysToDef(def: FormDefinitionV1, keys: string[] | null | undefined): string[] {
  const allowed = allowedWaiverMergeFieldKeys(def);
  return (keys ?? []).filter((k) => allowed.has(k));
}

export function buildWaiverMergeRows(
  def: FormDefinitionV1,
  keys: string[] | null | undefined,
  guardian: GuardianExtract,
  guardianCustom: Record<string, string | boolean | number | null>,
  child: ChildExtract,
): WaiverPdfMergeRow[] {
  const merged = filterWaiverMergeKeysToDef(def, keys);
  const gFlat: Record<string, string | boolean | number | null> = {
    guardianFirstName: guardian.guardianFirstName,
    guardianLastName: guardian.guardianLastName,
    guardianEmail: guardian.guardianEmail ?? null,
    guardianPhone: guardian.guardianPhone ?? null,
    ...guardianCustom,
  };
  const cFlat: Record<string, string | boolean | number | null> = {
    childFirstName: child.childFirstName,
    childLastName: child.childLastName,
    childDateOfBirth: child.childDateOfBirth,
    allergiesNotes: child.allergiesNotes ?? null,
    ...child.custom,
  };
  const rows: WaiverPdfMergeRow[] = [];
  for (const key of merged) {
    const field = fieldByKey(def, key);
    if (!field) continue;
    const aud = sectionAudience(def, field);
    const raw =
      aud === "guardian" || aud === "consent" ? gFlat[key] : aud === "eachChild" ? cFlat[key] : undefined;
    if (raw === undefined) continue;
    rows.push({ label: field.label, value: formatMergeValue(raw) });
  }
  return rows;
}

export function buildSupplementalPdfRows(
  defs: WaiverSupplementalFieldDef[],
  values: Record<string, string> | null | undefined,
): WaiverPdfMergeRow[] {
  const v = values ?? {};
  return defs.map((d) => ({ label: d.label, value: (v[d.key] ?? "").trim() || "—" }));
}

const PNG_SIG_RE = /^data:image\/png;base64,[A-Za-z0-9+/=]+$/;

export type WaiverPerChildSubmit = {
  signerName: string;
  signedAtIso: string;
  signatureDataUrl: string;
  accepted: boolean;
  supplemental?: Record<string, string>;
};

export function parseWaiverPerChildPayload(
  jsonRaw: string,
  childCount: number,
  supplementalDefs: WaiverSupplementalFieldDef[],
): { ok: true; value: WaiverPerChildSubmit[] } | { ok: false; message: string } {
  if (childCount < 1) return { ok: false, message: "Invalid registration data." };
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonRaw);
  } catch {
    return { ok: false, message: "Waiver data was invalid. Please refresh and try again." };
  }
  if (!Array.isArray(parsed) || parsed.length !== childCount) {
    return { ok: false, message: "Each child needs a completed waiver. Please go back to the consent step." };
  }
  const supKeys = new Set(supplementalDefs.map((d) => d.key));
  const out: WaiverPerChildSubmit[] = [];
  let i = 0;
  for (const row of parsed) {
    i++;
    if (!row || typeof row !== "object") {
      return { ok: false, message: `Child ${i}: waiver data is missing.` };
    }
    const o = row as Record<string, unknown>;
    const signerName = typeof o.signerName === "string" ? o.signerName.trim() : "";
    const signedAtIso = typeof o.signedAtIso === "string" ? o.signedAtIso.trim() : "";
    const signatureDataUrl = typeof o.signatureDataUrl === "string" ? o.signatureDataUrl.trim() : "";
    const accepted = o.accepted === true;
    if (!accepted) {
      return { ok: false, message: `Child ${i}: please accept the waiver terms and sign.` };
    }
    if (!signerName) {
      return { ok: false, message: `Child ${i}: please enter the signer name on the waiver.` };
    }
    if (!signedAtIso || Number.isNaN(new Date(signedAtIso).getTime())) {
      return { ok: false, message: `Child ${i}: please choose a valid waiver signature date and time.` };
    }
    if (!PNG_SIG_RE.test(signatureDataUrl)) {
      return {
        ok: false,
        message: `Child ${i}: electronic signature is missing — make sure the signer name is filled in above.`,
      };
    }
    const supplemental: Record<string, string> = {};
    if (o.supplemental && typeof o.supplemental === "object" && !Array.isArray(o.supplemental)) {
      const rawS = o.supplemental as Record<string, unknown>;
      for (const k of supKeys) {
        const v = rawS[k];
        supplemental[k] = typeof v === "string" ? v : v == null ? "" : String(v);
      }
    } else {
      for (const k of supKeys) supplemental[k] = "";
    }
    for (const d of supplementalDefs) {
      if (d.required && !supplemental[d.key]?.trim()) {
        return {
          ok: false,
          message: `Child ${i}: please complete “${d.label}” on the waiver.`,
        };
      }
    }
    out.push({ signerName, signedAtIso, signatureDataUrl, accepted, supplemental });
  }
  return { ok: true, value: out };
}
