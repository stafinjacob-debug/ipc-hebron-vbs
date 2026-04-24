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
