import {
  parseFormDefinitionJson,
  RESERVED_CHILD_KEYS,
  RESERVED_GUARDIAN_KEYS,
  type FormDefinitionV1,
} from "@/lib/registration-form-definition";

export type ExportFieldOption = {
  key: string;
  label: string;
  group: "core" | "guardian" | "child";
};

export const CORE_EXPORT_FIELDS: ExportFieldOption[] = [
  { key: "registrationId", label: "Registration ID", group: "core" },
  { key: "registrationNumber", label: "Registration #", group: "core" },
  { key: "status", label: "Status", group: "core" },
  { key: "registeredAt", label: "Registered at", group: "core" },
  { key: "seasonName", label: "Season", group: "core" },
  { key: "classroomName", label: "Classroom", group: "core" },
  { key: "submissionCode", label: "Submission code", group: "core" },
  { key: "staffNotes", label: "Staff notes", group: "core" },
];

export const DEFAULT_EXPORT_FIELD_KEYS = [
  "registrationNumber",
  "status",
  "registeredAt",
  "seasonName",
  "classroomName",
  "guardian:guardianFirstName",
  "guardian:guardianLastName",
  "guardian:guardianEmail",
  "guardian:guardianPhone",
  "child:childFirstName",
  "child:childLastName",
  "child:childDateOfBirth",
];

function addUnique(
  out: ExportFieldOption[],
  seen: Set<string>,
  item: ExportFieldOption,
) {
  if (seen.has(item.key)) return;
  seen.add(item.key);
  out.push(item);
}

export function buildRegistrationExportFieldOptions(
  def: FormDefinitionV1 | null,
): ExportFieldOption[] {
  const out: ExportFieldOption[] = [];
  const seen = new Set<string>();

  for (const c of CORE_EXPORT_FIELDS) addUnique(out, seen, c);

  addUnique(out, seen, {
    key: "guardian:guardianFirstName",
    label: "Guardian first name",
    group: "guardian",
  });
  addUnique(out, seen, {
    key: "guardian:guardianLastName",
    label: "Guardian last name",
    group: "guardian",
  });
  addUnique(out, seen, {
    key: "guardian:guardianEmail",
    label: "Guardian email",
    group: "guardian",
  });
  addUnique(out, seen, {
    key: "guardian:guardianPhone",
    label: "Guardian phone",
    group: "guardian",
  });

  addUnique(out, seen, {
    key: "child:childFirstName",
    label: "Child first name",
    group: "child",
  });
  addUnique(out, seen, {
    key: "child:childLastName",
    label: "Child last name",
    group: "child",
  });
  addUnique(out, seen, {
    key: "child:childDateOfBirth",
    label: "Child date of birth",
    group: "child",
  });
  addUnique(out, seen, {
    key: "child:allergiesNotes",
    label: "Child allergies / notes",
    group: "child",
  });

  if (!def) return out;

  const sectionById = new Map(def.sections.map((s) => [s.id, s]));
  const sortedFields = [...def.fields].sort((a, b) => a.order - b.order);
  for (const f of sortedFields) {
    if (f.type === "sectionHeader" || f.type === "staticText") continue;
    const section = sectionById.get(f.sectionId);
    const audience = section?.audience;
    if (audience === "guardian") {
      if (RESERVED_GUARDIAN_KEYS.has(f.key)) continue;
      addUnique(out, seen, { key: `guardian:${f.key}`, label: `Guardian: ${f.label}`, group: "guardian" });
    } else if (audience === "eachChild") {
      if (RESERVED_CHILD_KEYS.has(f.key)) continue;
      addUnique(out, seen, { key: `child:${f.key}`, label: `Child: ${f.label}`, group: "child" });
    }
  }
  return out;
}

export function buildRegistrationExportFieldOptionsFromJson(
  json: string | null | undefined,
): ExportFieldOption[] {
  return buildRegistrationExportFieldOptions(parseFormDefinitionJson(json));
}

/** Guardian and child fields from the registration form — suitable for badge printing. */
export function badgePrintableFormFieldOptions(
  json: string | null | undefined,
): ExportFieldOption[] {
  return buildRegistrationExportFieldOptionsFromJson(json).filter(
    (o) => o.group === "guardian" || o.group === "child",
  );
}

function asObject(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

export function formatExportFieldValue(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (Array.isArray(v)) return v.map((x) => String(x)).join(", ");
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

export type RegistrationFieldValueRow = {
  id: string;
  registrationNumber: string | null;
  status: string;
  registeredAt: Date;
  notes: string | null;
  customResponses: unknown;
  child: {
    firstName: string;
    lastName: string;
    dateOfBirth: Date;
    allergiesNotes: string | null;
    guardian: {
      firstName: string;
      lastName: string;
      email: string | null;
      phone: string | null;
    };
  };
  classroom: { name: string } | null;
  formSubmission: {
    registrationCode: string | null;
    guardianResponses: unknown;
  } | null;
};

export function resolveRegistrationExportFieldValue(
  row: RegistrationFieldValueRow,
  seasonName: string,
  fieldKey: string,
): string {
  const guardianExtra = asObject(row.formSubmission?.guardianResponses);
  const childExtra = asObject(row.customResponses);

  if (fieldKey === "registrationId") return row.id;
  if (fieldKey === "registrationNumber") return row.registrationNumber ?? "";
  if (fieldKey === "status") return row.status;
  if (fieldKey === "registeredAt") return row.registeredAt.toISOString();
  if (fieldKey === "seasonName") return seasonName;
  if (fieldKey === "classroomName") return row.classroom?.name ?? "";
  if (fieldKey === "submissionCode") return row.formSubmission?.registrationCode ?? "";
  if (fieldKey === "staffNotes") return row.notes ?? "";

  if (fieldKey.startsWith("guardian:")) {
    const fld = fieldKey.slice("guardian:".length);
    if (fld === "guardianFirstName") return row.child.guardian.firstName;
    if (fld === "guardianLastName") return row.child.guardian.lastName;
    if (fld === "guardianEmail") return row.child.guardian.email ?? "";
    if (fld === "guardianPhone") return row.child.guardian.phone ?? "";
    return formatExportFieldValue(guardianExtra[fld]);
  }

  if (fieldKey.startsWith("child:")) {
    const fld = fieldKey.slice("child:".length);
    if (fld === "childFirstName") return row.child.firstName;
    if (fld === "childLastName") return row.child.lastName;
    if (fld === "childDateOfBirth") return row.child.dateOfBirth.toISOString().slice(0, 10);
    if (fld === "allergiesNotes") return row.child.allergiesNotes ?? "";
    return formatExportFieldValue(childExtra[fld]);
  }

  return "";
}
