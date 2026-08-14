import { z } from "zod";

/** Supported field types for standalone embedded (application) forms. */
export const embeddedFieldTypeSchema = z.enum([
  "text",
  "textarea",
  "email",
  "tel",
  "select",
  "radio",
  "checkbox",
  "checkboxGroup",
  "date",
  "number",
  "photo",
  "signatureTyped",
  "sectionHeader",
  "staticText",
  "declaration",
  /** Dynamic education rows applicants can add (description + institution columns). */
  "educationEntries",
  /** Multi-file upload for supporting documents (PDF/images). */
  "documentUploads",
]);

export type EmbeddedFieldType = z.infer<typeof embeddedFieldTypeSchema>;

export const embeddedFieldVisibilitySchema = z.enum(["applicant", "admin", "both"]);
export type EmbeddedFieldVisibility = z.infer<typeof embeddedFieldVisibilitySchema>;

export const embeddedFormSectionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  order: z.number().int(),
  /** When true, section is shown only in admin/registrar UI (and PDF registrar box). */
  adminOnly: z.boolean().optional(),
});

export const embeddedFormFieldSchema = z.object({
  id: z.string().min(1),
  sectionId: z.string().min(1),
  key: z
    .string()
    .min(1)
    .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, "Key must start with a letter and use letters, numbers, or underscore"),
  type: embeddedFieldTypeSchema,
  label: z.string().min(1),
  required: z.boolean(),
  order: z.number().int(),
  helperText: z.string().optional(),
  placeholder: z.string().optional(),
  defaultValue: z.string().optional(),
  options: z.array(z.object({ value: z.string(), label: z.string() })).optional(),
  showWhen: z
    .object({
      fieldKey: z.string(),
      equals: z.string(),
    })
    .optional(),
  visibility: embeddedFieldVisibilitySchema.default("applicant"),
  /** Optional layout hint for multi-column rows in the public wizard / PDF. */
  layout: z
    .object({
      columns: z.number().int().min(1).max(6).optional(),
      width: z.enum(["full", "half", "third", "quarter"]).optional(),
      groupKey: z.string().optional(),
    })
    .optional(),
  validation: z
    .object({
      minLength: z.number().optional(),
      maxLength: z.number().optional(),
      min: z.number().optional(),
      max: z.number().optional(),
      pattern: z.string().optional(),
    })
    .optional(),
});

export const embeddedFormDefinitionSchema = z.object({
  version: z.literal(1),
  templateKey: z.string().optional(),
  sections: z.array(embeddedFormSectionSchema),
  fields: z.array(embeddedFormFieldSchema),
});

export type EmbeddedFormDefinitionV1 = z.infer<typeof embeddedFormDefinitionSchema>;
export type EmbeddedFormFieldDef = z.infer<typeof embeddedFormFieldSchema>;
export type EmbeddedFormSectionDef = z.infer<typeof embeddedFormSectionSchema>;

export function parseEmbeddedFormDefinitionJson(
  json: string | null | undefined,
): EmbeddedFormDefinitionV1 | null {
  if (!json?.trim()) return null;
  try {
    const raw = JSON.parse(json) as unknown;
    const r = embeddedFormDefinitionSchema.safeParse(raw);
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}

export function assertValidEmbeddedDefinition(json: string): EmbeddedFormDefinitionV1 {
  const raw = JSON.parse(json) as unknown;
  return embeddedFormDefinitionSchema.parse(raw);
}

export function embeddedDefinitionToJson(def: EmbeddedFormDefinitionV1): string {
  return JSON.stringify(def, null, 2);
}

export function sortEmbeddedSections(def: EmbeddedFormDefinitionV1): EmbeddedFormSectionDef[] {
  return [...def.sections].sort((a, b) => a.order - b.order);
}

export function fieldsForEmbeddedSection(
  def: EmbeddedFormDefinitionV1,
  sectionId: string,
): EmbeddedFormFieldDef[] {
  return def.fields.filter((f) => f.sectionId === sectionId).sort((a, b) => a.order - b.order);
}

export function applicantVisibleSections(def: EmbeddedFormDefinitionV1): EmbeddedFormSectionDef[] {
  return sortEmbeddedSections(def).filter((s) => !s.adminOnly);
}

export function applicantVisibleFields(def: EmbeddedFormDefinitionV1): EmbeddedFormFieldDef[] {
  const adminSectionIds = new Set(def.sections.filter((s) => s.adminOnly).map((s) => s.id));
  return def.fields
    .filter((f) => {
      if (adminSectionIds.has(f.sectionId)) return false;
      const vis = f.visibility ?? "applicant";
      return vis === "applicant" || vis === "both";
    })
    .sort((a, b) => a.order - b.order);
}

export function adminOnlyFields(def: EmbeddedFormDefinitionV1): EmbeddedFormFieldDef[] {
  const adminSectionIds = new Set(def.sections.filter((s) => s.adminOnly).map((s) => s.id));
  return def.fields
    .filter((f) => {
      if (adminSectionIds.has(f.sectionId)) return true;
      return (f.visibility ?? "applicant") === "admin";
    })
    .sort((a, b) => a.order - b.order);
}

export function isFillableEmbeddedField(f: EmbeddedFormFieldDef): boolean {
  return f.type !== "sectionHeader" && f.type !== "staticText";
}

export function fieldIsVisible(
  field: EmbeddedFormFieldDef,
  responses: Record<string, unknown>,
): boolean {
  if (!field.showWhen) return true;
  const raw = responses[field.showWhen.fieldKey];
  const value = Array.isArray(raw) ? raw.join(",") : String(raw ?? "");
  return value === field.showWhen.equals;
}

export type EducationEntry = {
  description: string;
  institution: string;
  completionDate: string;
  diplomaDegree: string;
  classDivision: string;
  passedFailed: string;
};

export const EDUCATION_DESCRIPTION_OPTIONS = [
  { value: "High School", label: "High School" },
  { value: "Undergrad", label: "Undergrad" },
  { value: "Graduate School", label: "Graduate School" },
  { value: "Other, if any", label: "Other, if any" },
] as const;

export function emptyEducationEntry(description = ""): EducationEntry {
  return {
    description,
    institution: "",
    completionDate: "",
    diplomaDegree: "",
    classDivision: "",
    passedFailed: "",
  };
}

export function parseEducationEntries(value: unknown): EducationEntry[] {
  if (!Array.isArray(value)) return [];
  return value.map((row) => {
    const r = (row ?? {}) as Record<string, unknown>;
    return {
      description: String(r.description ?? "").trim(),
      institution: String(r.institution ?? "").trim(),
      completionDate: String(r.completionDate ?? "").trim(),
      diplomaDegree: String(r.diplomaDegree ?? "").trim(),
      classDivision: String(r.classDivision ?? "").trim(),
      passedFailed: String(r.passedFailed ?? "").trim(),
    };
  });
}

/** Reserved response keys used for search / email / PDF identity. */
export const EMBEDDED_RESERVED_KEYS = {
  fullName: "fullName",
  email: "email",
  phone: "phone",
  photo: "passportPhoto",
  signature: "applicantSignature",
  signatureDate: "applicantSignatureDate",
  declarationAccepted: "declarationAccepted",
} as const;
