import {
  applicantVisibleFields,
  fieldIsVisible,
  isFillableEmbeddedField,
  parseEducationEntries,
  type EmbeddedFormDefinitionV1,
  type EmbeddedFormFieldDef,
  type EducationEntry,
} from "@/lib/embedded-form-definition";

export type EmbeddedParseResult =
  | {
      ok: true;
      responses: Record<string, unknown>;
      applicantFullName: string;
      applicantEmail: string;
      applicantPhone: string | null;
      signatureTypedName: string;
      signatureDate: string;
      declarationAccepted: boolean;
      ageNow: number | null;
    }
  | { ok: false; error: string; fieldErrors: Record<string, string> };

function asString(v: FormDataEntryValue | null | undefined): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  return "";
}

function ageFromDob(day: number, month: number, year: number, asOf = new Date()): number | null {
  if (!Number.isFinite(day) || !Number.isFinite(month) || !Number.isFinite(year)) return null;
  if (year < 1900 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const birth = new Date(year, month - 1, day);
  if (Number.isNaN(birth.getTime())) return null;
  let age = asOf.getFullYear() - year;
  const m = asOf.getMonth() - (month - 1);
  if (m < 0 || (m === 0 && asOf.getDate() < day)) age -= 1;
  return age >= 0 && age < 130 ? age : null;
}

function validateSingleField(
  field: EmbeddedFormFieldDef,
  raw: string | string[],
): string | null {
  const empty =
    Array.isArray(raw) ? raw.length === 0 : !String(raw ?? "").trim();

  if (field.required && empty && field.type !== "photo") {
    return "This field is required.";
  }
  if (empty) return null;

  const value = Array.isArray(raw) ? raw.join(", ") : String(raw).trim();
  const v = field.validation;

  if (field.type === "email") {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "Enter a valid email address.";
  }
  if (field.type === "number") {
    const n = Number(value);
    if (!Number.isFinite(n)) return "Enter a valid number.";
    if (v?.min != null && n < v.min) return `Must be at least ${v.min}.`;
    if (v?.max != null && n > v.max) return `Must be at most ${v.max}.`;
  }
  if (field.type === "radio" || field.type === "select") {
    const opts = (field.options ?? []).map((o) => o.value).filter((x) => x !== "");
    if (opts.length && !opts.includes(value)) return "Select a valid option.";
  }
  if (field.type === "checkboxGroup" && Array.isArray(raw)) {
    const opts = new Set((field.options ?? []).map((o) => o.value));
    for (const item of raw) {
      if (!opts.has(item)) return "Invalid checkbox selection.";
    }
  }
  if (v?.minLength != null && value.length < v.minLength) {
    return `Must be at least ${v.minLength} characters.`;
  }
  if (v?.maxLength != null && value.length > v.maxLength) {
    return `Must be at most ${v.maxLength} characters.`;
  }
  if (v?.pattern) {
    try {
      if (!new RegExp(v.pattern).test(value)) return "Invalid format.";
    } catch {
      /* ignore bad pattern */
    }
  }
  return null;
}

/** Parse applicant FormData against a published embedded definition. */
export function parseEmbeddedApplicantForm(
  def: EmbeddedFormDefinitionV1,
  formData: FormData,
): EmbeddedParseResult {
  const fieldErrors: Record<string, string> = {};
  const responses: Record<string, unknown> = {};
  const fields = applicantVisibleFields(def).filter(isFillableEmbeddedField);

  // First pass: collect raw values (needed for showWhen)
  const rawMap: Record<string, string | string[] | EducationEntry[]> = {};
  for (const field of fields) {
    if (field.type === "checkboxGroup") {
      rawMap[field.key] = formData
        .getAll(field.key)
        .map((x) => String(x).trim())
        .filter(Boolean);
    } else if (field.type === "educationEntries") {
      const json = asString(formData.get(field.key));
      try {
        rawMap[field.key] = parseEducationEntries(json ? JSON.parse(json) : []);
      } catch {
        rawMap[field.key] = [];
      }
    } else if (field.type === "documentUploads") {
      const files = formData
        .getAll(field.key)
        .filter((x): x is File => x instanceof File && x.size > 0);
      rawMap[field.key] = files.length > 0 ? String(files.length) : asString(formData.get(`${field.key}__count`));
    } else if (field.type === "photo") {
      rawMap[field.key] = asString(formData.get(`${field.key}__present`)) || asString(formData.get(field.key));
    } else if (field.type === "checkbox" || field.type === "declaration") {
      rawMap[field.key] = formData.get(field.key) ? "true" : "";
    } else {
      rawMap[field.key] = asString(formData.get(field.key));
    }
  }

  for (const field of fields) {
    if (!fieldIsVisible(field, rawMap)) continue;
    const raw = rawMap[field.key] ?? "";

    if (field.type === "photo") {
      const hasFile = formData.get(field.key) instanceof File && (formData.get(field.key) as File).size > 0;
      const present = asString(formData.get(`${field.key}__present`)) === "1" || hasFile;
      if (field.required && !present) {
        fieldErrors[field.key] = "Please upload a passport photo.";
      }
      responses[field.key] = present ? "uploaded" : "";
      continue;
    }

    if (field.type === "documentUploads") {
      const files = formData
        .getAll(field.key)
        .filter((x): x is File => x instanceof File && x.size > 0);
      const maxFiles = field.validation?.max ?? 5;
      if (field.required && files.length === 0) {
        fieldErrors[field.key] = "Please upload at least one academic document.";
      } else if (files.length > maxFiles) {
        fieldErrors[field.key] = `You can upload at most ${maxFiles} documents.`;
      }
      responses[field.key] = files.length > 0 ? `${files.length} file(s)` : "";
      continue;
    }

    if (field.type === "educationEntries") {
      const entries = Array.isArray(raw) ? (raw as EducationEntry[]) : [];
      const usable = entries.filter((e) => e.description || e.institution);
      if (field.required && usable.length === 0) {
        fieldErrors[field.key] = "Add at least one educational qualification.";
      } else {
        for (let i = 0; i < usable.length; i++) {
          const row = usable[i]!;
          if (!row.description.trim()) {
            fieldErrors[field.key] = `Education row ${i + 1}: choose a description.`;
            break;
          }
          if (!row.institution.trim()) {
            fieldErrors[field.key] = `Education row ${i + 1}: enter name & place of institution.`;
            break;
          }
        }
      }
      const allowed = new Set((field.options ?? []).map((o) => o.value));
      for (const row of usable) {
        if (allowed.size && row.description && !allowed.has(row.description)) {
          fieldErrors[field.key] = "Invalid education description selected.";
          break;
        }
      }
      responses[field.key] = usable;
      continue;
    }

    const err = validateSingleField(
      field,
      Array.isArray(raw) ? (raw as string[]) : String(raw),
    );
    if (err) fieldErrors[field.key] = err;

    if (field.type === "checkbox" || field.type === "declaration") {
      responses[field.key] = Boolean(raw);
    } else if (field.type === "checkboxGroup") {
      responses[field.key] = Array.isArray(raw) ? raw : [];
    } else if (field.type === "number") {
      const n = Number(String(raw).trim());
      responses[field.key] = String(raw).trim() === "" ? "" : Number.isFinite(n) ? n : raw;
    } else {
      responses[field.key] = Array.isArray(raw) ? (raw as string[]).join(", ") : String(raw);
    }
  }

  // Clear marriage-only answers if unmarried (defense in depth)
  if (String(responses.maritalStatus ?? "") !== "Married") {
    delete responses.dateOfMarriage;
    delete responses.spouseName;
    delete responses.child1NameAge;
    delete responses.child2NameAge;
    delete responses.child3NameAge;
  }
  if (String(responses.ordainedPastor ?? "") !== "Yes") {
    delete responses.ordinationDetails;
  }

  const day = Number(responses.dobDay);
  const month = Number(responses.dobMonth);
  const year = Number(responses.dobYear);
  let ageNow =
    responses.ageNow !== "" && responses.ageNow != null
      ? Number(responses.ageNow)
      : ageFromDob(day, month, year);
  if (ageNow != null && Number.isFinite(ageNow)) {
    responses.ageNow = ageNow;
  } else {
    ageNow = null;
  }

  const applicantFullName = String(responses.fullName ?? "").trim();
  const applicantEmail = String(responses.email ?? "").trim().toLowerCase();
  const applicantPhone = String(responses.phone ?? "").trim() || null;
  const signatureTypedName = String(responses.applicantSignature ?? "").trim();
  const signatureDate = String(responses.applicantSignatureDate ?? "").trim();
  const declarationAccepted = responses.declarationAccepted === true;

  if (!applicantFullName) fieldErrors.fullName = fieldErrors.fullName ?? "Full name is required.";
  if (!applicantEmail) fieldErrors.email = fieldErrors.email ?? "Email is required.";
  if (!declarationAccepted) {
    fieldErrors.declarationAccepted = "You must accept the declaration and pledge.";
  }
  if (!signatureTypedName) {
    fieldErrors.applicantSignature = fieldErrors.applicantSignature ?? "Type your legal name as signature.";
  }
  if (
    signatureTypedName &&
    applicantFullName &&
    signatureTypedName.toLowerCase() !== applicantFullName.toLowerCase()
  ) {
    // Soft check — warn via helper but still allow if declaration name differs slightly; require non-empty.
  }

  if (Object.keys(fieldErrors).length) {
    const first = Object.values(fieldErrors)[0] ?? "Please correct the highlighted fields.";
    return { ok: false, error: first, fieldErrors };
  }

  return {
    ok: true,
    responses,
    applicantFullName,
    applicantEmail,
    applicantPhone,
    signatureTypedName,
    signatureDate,
    declarationAccepted,
    ageNow,
  };
}

/** Parse admin registrar FormData. */
export function parseEmbeddedRegistrarForm(
  def: EmbeddedFormDefinitionV1,
  formData: FormData,
): { ok: true; responses: Record<string, unknown> } | { ok: false; error: string } {
  const adminSectionIds = new Set(def.sections.filter((s) => s.adminOnly).map((s) => s.id));
  const fields = def.fields.filter(
    (f) =>
      isFillableEmbeddedField(f) &&
      (adminSectionIds.has(f.sectionId) || (f.visibility ?? "applicant") === "admin"),
  );
  const responses: Record<string, unknown> = {};
  for (const field of fields) {
    if (field.type === "checkboxGroup") {
      responses[field.key] = formData
        .getAll(field.key)
        .map((x) => String(x).trim())
        .filter(Boolean);
    } else if (field.type === "checkbox" || field.type === "declaration") {
      responses[field.key] = Boolean(formData.get(field.key));
    } else {
      responses[field.key] = asString(formData.get(field.key));
    }
  }
  return { ok: true, responses };
}

export function responseToDisplayString(value: unknown): string {
  if (value == null) return "";
  if (Array.isArray(value)) {
    if (value.length === 0) return "";
    if (typeof value[0] === "object" && value[0] != null) {
      return value
        .map((row) => {
          const r = row as Record<string, unknown>;
          const parts = [
            r.description,
            r.institution,
            r.completionDate,
            r.diplomaDegree,
            r.classDivision,
            r.passedFailed,
          ]
            .map((x) => String(x ?? "").trim())
            .filter(Boolean);
          return parts.join(" · ");
        })
        .filter(Boolean)
        .join("\n");
    }
    return value.join(", ");
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}
