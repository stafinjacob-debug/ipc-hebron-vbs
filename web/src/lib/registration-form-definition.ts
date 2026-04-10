import { z } from "zod";

/** Supported dynamic field types for the registration form builder. */
export const fieldTypeSchema = z.enum([
  "text",
  "textarea",
  "email",
  "tel",
  "select",
  "radio",
  "checkbox",
  "date",
  "number",
  "boolean",
  "sectionHeader",
  "staticText",
]);

export type FieldType = z.infer<typeof fieldTypeSchema>;

export const formSectionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  audience: z.enum(["guardian", "eachChild", "consent", "static"]),
  order: z.number().int(),
});

export const formFieldSchema = z.object({
  id: z.string().min(1),
  sectionId: z.string().min(1),
  key: z
    .string()
    .min(1)
    .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, "Key must start with a letter and use letters, numbers, or underscore"),
  type: fieldTypeSchema,
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

export const formDefinitionSchema = z.object({
  version: z.literal(1),
  sections: z.array(formSectionSchema),
  fields: z.array(formFieldSchema),
});

export type FormDefinitionV1 = z.infer<typeof formDefinitionSchema>;
export type FormFieldDef = z.infer<typeof formFieldSchema>;
export type FormSectionDef = z.infer<typeof formSectionSchema>;

/** Reserved keys mapped to Guardian / Child / Registration columns. */
export const RESERVED_GUARDIAN_KEYS = new Set([
  "guardianFirstName",
  "guardianLastName",
  "guardianEmail",
  "guardianPhone",
]);

export const RESERVED_CHILD_KEYS = new Set([
  "childFirstName",
  "childLastName",
  "childDateOfBirth",
  "allergiesNotes",
]);

export function parseFormDefinitionJson(json: string | null | undefined): FormDefinitionV1 | null {
  if (!json?.trim()) return null;
  try {
    const raw = JSON.parse(json) as unknown;
    const r = formDefinitionSchema.safeParse(raw);
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}

export function assertValidDefinition(json: string): FormDefinitionV1 {
  const raw = JSON.parse(json) as unknown;
  return formDefinitionSchema.parse(raw);
}

/** Default template aligned with the original public form (editable in admin). */
export function createDefaultFormDefinition(): FormDefinitionV1 {
  return {
    version: 1,
    sections: [
      {
        id: "sec_guardian",
        title: "Parent / guardian",
        description: "We’ll use this for event updates and emergencies.",
        audience: "guardian",
        order: 0,
      },
      {
        id: "sec_child",
        title: "Child attending VBS",
        description: "Tell us about each student. Add more children on the next step if needed.",
        audience: "eachChild",
        order: 1,
      },
      {
        id: "sec_consent",
        title: "Consent",
        description: "",
        audience: "consent",
        order: 2,
      },
    ],
    fields: [
      {
        id: "f_g_fn",
        sectionId: "sec_guardian",
        key: "guardianFirstName",
        type: "text",
        label: "First name",
        required: true,
        order: 0,
        placeholder: "e.g. Maria",
      },
      {
        id: "f_g_ln",
        sectionId: "sec_guardian",
        key: "guardianLastName",
        type: "text",
        label: "Last name",
        required: true,
        order: 1,
        placeholder: "e.g. Santos",
      },
      {
        id: "f_g_em",
        sectionId: "sec_guardian",
        key: "guardianEmail",
        type: "email",
        label: "Email",
        required: false,
        order: 2,
        helperText: "We’ll only use this for VBS-related communication.",
        placeholder: "name@example.com",
      },
      {
        id: "f_g_ph",
        sectionId: "sec_guardian",
        key: "guardianPhone",
        type: "tel",
        label: "Phone",
        required: false,
        order: 3,
        helperText: "For day-of questions or emergencies.",
        placeholder: "(555) 123-4567",
      },
      {
        id: "f_c_fn",
        sectionId: "sec_child",
        key: "childFirstName",
        type: "text",
        label: "Child’s first name",
        required: true,
        order: 0,
      },
      {
        id: "f_c_ln",
        sectionId: "sec_child",
        key: "childLastName",
        type: "text",
        label: "Child’s last name",
        required: true,
        order: 1,
      },
      {
        id: "f_c_dob",
        sectionId: "sec_child",
        key: "childDateOfBirth",
        type: "date",
        label: "Date of birth",
        required: true,
        order: 2,
        helperText: "Used to place your child in the right age group.",
      },
      {
        id: "f_c_alg",
        sectionId: "sec_child",
        key: "allergiesNotes",
        type: "textarea",
        label: "Allergies or medical notes",
        required: false,
        order: 3,
        helperText: "Optional — helps teachers keep everyone safe.",
        placeholder: "None, or describe allergies / medications",
      },
    ],
  };
}

export function definitionToJson(def: FormDefinitionV1): string {
  return JSON.stringify(def, null, 2);
}

export function sortSections(def: FormDefinitionV1): FormSectionDef[] {
  return [...def.sections].sort((a, b) => a.order - b.order);
}

export function fieldsForSection(def: FormDefinitionV1, sectionId: string): FormFieldDef[] {
  return def.fields.filter((f) => f.sectionId === sectionId).sort((a, b) => a.order - b.order);
}

export function fieldsForAudience(def: FormDefinitionV1, audience: FormSectionDef["audience"]): FormFieldDef[] {
  const sectionIds = new Set(def.sections.filter((s) => s.audience === audience).map((s) => s.id));
  return def.fields.filter((f) => sectionIds.has(f.sectionId)).sort((a, b) => a.order - b.order);
}

/** Per-child form fields usable for class auto-match (excludes section headers / static blocks). */
export function listChildAssignableFieldOptions(def: FormDefinitionV1): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = [];
  for (const f of fieldsForAudience(def, "eachChild")) {
    if (f.type === "sectionHeader" || f.type === "staticText") continue;
    out.push({ key: f.key, label: f.label });
  }
  return out;
}
