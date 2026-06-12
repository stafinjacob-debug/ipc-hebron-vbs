import type { Prisma } from "@/generated/prisma";
import { getEffectiveDefinition } from "@/lib/ensure-registration-form";
import { prisma } from "@/lib/prisma";
import {
  normalizeRegistrantLookupEmail,
  normalizeRegistrantLookupPhone,
  registrantLookupRegistrationWhere,
  registrantLookupRegistrationWhereForSeason,
} from "@/lib/registrant-lookup";
import {
  createDefaultFormDefinition,
  parseFormDefinitionJson,
  RESERVED_CHILD_KEYS,
  RESERVED_GUARDIAN_KEYS,
  type FormDefinitionV1,
} from "@/lib/registration-form-definition";

export const DEFAULT_REGISTRANT_LOOKUP_EMAIL_FIELD = "guardianEmail";
export const DEFAULT_REGISTRANT_LOOKUP_PHONE_FIELD = "guardianPhone";

export type RegistrantLookupFieldConfig = {
  emailFieldKey: string;
  phoneFieldKey: string;
};

export function lookupFieldConfigFromForm(form: {
  registrantLookupEmailFieldKey?: string | null;
  registrantLookupPhoneFieldKey?: string | null;
} | null | undefined): RegistrantLookupFieldConfig {
  return {
    emailFieldKey:
      form?.registrantLookupEmailFieldKey?.trim() || DEFAULT_REGISTRANT_LOOKUP_EMAIL_FIELD,
    phoneFieldKey:
      form?.registrantLookupPhoneFieldKey?.trim() || DEFAULT_REGISTRANT_LOOKUP_PHONE_FIELD,
  };
}

function fieldAudienceForKey(
  def: FormDefinitionV1 | null,
  fieldKey: string,
): "guardian" | "eachChild" | "consent" {
  if (RESERVED_GUARDIAN_KEYS.has(fieldKey)) return "guardian";
  if (RESERVED_CHILD_KEYS.has(fieldKey)) return "eachChild";
  const field = def?.fields.find((f) => f.key === fieldKey);
  if (!field || !def) return "guardian";
  const section = def.sections.find((s) => s.id === field.sectionId);
  if (section?.audience === "eachChild") return "eachChild";
  if (section?.audience === "consent") return "consent";
  return "guardian";
}

export function readLookupFieldValue(args: {
  fieldKey: string;
  definition: FormDefinitionV1 | null;
  guardian: { email?: string | null; phone?: string | null };
  guardianResponses: Record<string, unknown>;
  customResponses: Record<string, unknown>;
}): string {
  if (args.fieldKey === DEFAULT_REGISTRANT_LOOKUP_EMAIL_FIELD) {
    return (args.guardian.email ?? "").trim();
  }
  if (args.fieldKey === DEFAULT_REGISTRANT_LOOKUP_PHONE_FIELD) {
    return (args.guardian.phone ?? "").trim();
  }

  const audience = fieldAudienceForKey(args.definition, args.fieldKey);
  const raw =
    audience === "eachChild"
      ? args.customResponses[args.fieldKey]
      : args.guardianResponses[args.fieldKey];
  if (raw == null) return "";
  if (typeof raw === "boolean") return raw ? "true" : "false";
  return String(raw).trim();
}

export function lookupEmailMatches(stored: string, emailNormalized: string): boolean {
  const value = stored.trim();
  if (!value) return false;
  return normalizeRegistrantLookupEmail(value) === emailNormalized;
}

export function lookupPhoneMatches(stored: string, inputDigits: string): boolean {
  const storedDigits = normalizeRegistrantLookupPhone(stored);
  return storedDigits.length >= 10 && storedDigits === inputDigits;
}

export const registrantLookupRegistrationInclude = {
  season: {
    select: {
      name: true,
      registrationForm: {
        select: {
          registrantLookupEmailFieldKey: true,
          registrantLookupPhoneFieldKey: true,
          publishedDefinitionJson: true,
          draftDefinitionJson: true,
        },
      },
    },
  },
  child: {
    select: {
      firstName: true,
      lastName: true,
      guardian: { select: { email: true, phone: true } },
    },
  },
  formSubmission: {
    select: {
      id: true,
      registrationCode: true,
      guardianResponses: true,
      guardian: { select: { email: true, phone: true } },
    },
  },
} satisfies Prisma.RegistrationInclude;

export type RegistrantLookupRegistrationRow = Prisma.RegistrationGetPayload<{
  include: typeof registrantLookupRegistrationInclude;
}>;

function definitionForRegistrationRow(row: RegistrantLookupRegistrationRow): FormDefinitionV1 {
  const form = row.season.registrationForm;
  return (
    getEffectiveDefinition(
      {
        publishedDefinitionJson: form?.publishedDefinitionJson ?? null,
        draftDefinitionJson: form?.draftDefinitionJson ?? null,
      },
      false,
    ) ?? createDefaultFormDefinition()
  );
}

export function lookupContextFromRegistration(row: RegistrantLookupRegistrationRow) {
  const form = row.season.registrationForm;
  const config = lookupFieldConfigFromForm(form);
  const definition = definitionForRegistrationRow(row);
  const guardian = row.child.guardian;
  const guardianResponses =
    (row.formSubmission?.guardianResponses as Record<string, unknown> | null) ?? {};
  const customResponses = (row.customResponses as Record<string, unknown> | null) ?? {};
  return { config, definition, guardian, guardianResponses, customResponses };
}

export function registrationLookupEmail(row: RegistrantLookupRegistrationRow): string {
  const ctx = lookupContextFromRegistration(row);
  return readLookupFieldValue({
    fieldKey: ctx.config.emailFieldKey,
    definition: ctx.definition,
    guardian: ctx.guardian,
    guardianResponses: ctx.guardianResponses,
    customResponses: ctx.customResponses,
  });
}

export function registrationLookupPhone(row: RegistrantLookupRegistrationRow): string {
  const ctx = lookupContextFromRegistration(row);
  return readLookupFieldValue({
    fieldKey: ctx.config.phoneFieldKey,
    definition: ctx.definition,
    guardian: ctx.guardian,
    guardianResponses: ctx.guardianResponses,
    customResponses: ctx.customResponses,
  });
}

export function registrationMatchesLookupEmail(
  row: RegistrantLookupRegistrationRow,
  emailNormalized: string,
): boolean {
  return lookupEmailMatches(registrationLookupEmail(row), emailNormalized);
}

export function registrationMatchesLookupPhone(
  row: RegistrantLookupRegistrationRow,
  phoneDigits: string,
): boolean {
  return lookupPhoneMatches(registrationLookupPhone(row), phoneDigits);
}

async function loadDistinctLookupFieldKeys(): Promise<{ emailKeys: string[]; phoneKeys: string[] }> {
  const forms = await prisma.registrationForm.findMany({
    where: { registrantLookupEnabled: true },
    select: {
      registrantLookupEmailFieldKey: true,
      registrantLookupPhoneFieldKey: true,
    },
  });
  const emailKeys = new Set<string>();
  const phoneKeys = new Set<string>();
  for (const form of forms) {
    emailKeys.add(lookupFieldConfigFromForm(form).emailFieldKey);
    phoneKeys.add(lookupFieldConfigFromForm(form).phoneFieldKey);
  }
  if (emailKeys.size === 0) emailKeys.add(DEFAULT_REGISTRANT_LOOKUP_EMAIL_FIELD);
  if (phoneKeys.size === 0) phoneKeys.add(DEFAULT_REGISTRANT_LOOKUP_PHONE_FIELD);
  return { emailKeys: [...emailKeys], phoneKeys: [...phoneKeys] };
}

function registrationCodeWhere(registrationCode?: string): Prisma.RegistrationWhereInput {
  const trimmed = registrationCode?.trim();
  if (!trimmed) return {};
  return {
    OR: [
      { formSubmission: { registrationCode: { equals: trimmed, mode: "insensitive" } } },
      { registrationNumber: { equals: trimmed, mode: "insensitive" } },
    ],
  };
}

function buildEmailLookupOr(emailNormalized: string, emailKeys: string[]): Prisma.RegistrationWhereInput[] {
  const or: Prisma.RegistrationWhereInput[] = [];
  for (const key of emailKeys) {
    if (key === DEFAULT_REGISTRANT_LOOKUP_EMAIL_FIELD) {
      or.push({
        child: { guardian: { email: { equals: emailNormalized, mode: "insensitive" } } },
      });
      continue;
    }
    or.push({ formSubmission: { guardianResponses: { path: [key], equals: emailNormalized } } });
    or.push({ customResponses: { path: [key], equals: emailNormalized } });
  }
  return or;
}

function buildPhoneLookupOr(phoneDigits: string, phoneKeys: string[]): Prisma.RegistrationWhereInput[] {
  const or: Prisma.RegistrationWhereInput[] = [];
  const area = phoneDigits.slice(0, 3);
  const last4 = phoneDigits.slice(-4);
  /** Match formatted numbers like (346) 208-0014 — full digit string is not contiguous in storage. */
  const formattedPhoneMatch: Prisma.RegistrationWhereInput = {
    AND: [
      { child: { guardian: { phone: { contains: area } } } },
      { child: { guardian: { phone: { contains: last4 } } } },
    ],
  };

  for (const key of phoneKeys) {
    if (key === DEFAULT_REGISTRANT_LOOKUP_PHONE_FIELD) {
      or.push(formattedPhoneMatch);
      continue;
    }
    or.push({ formSubmissionId: { not: null } });
  }
  return or;
}

export async function findRegistrationsForLookupEmail(
  emailNormalized: string,
  registrationCode?: string,
  seasonId?: string | null,
): Promise<RegistrantLookupRegistrationRow[]> {
  const { emailKeys } = await loadDistinctLookupFieldKeys();
  const orConditions = buildEmailLookupOr(emailNormalized, emailKeys);
  const rows = await prisma.registration.findMany({
    where: {
      ...registrantLookupRegistrationWhereForSeason(seasonId),
      ...registrationCodeWhere(registrationCode),
      OR: orConditions.length > 0 ? orConditions : undefined,
    },
    include: registrantLookupRegistrationInclude,
    orderBy: { registeredAt: "desc" },
    take: 150,
  });
  return rows.filter((row) => registrationMatchesLookupEmail(row, emailNormalized));
}

export async function findRegistrationsForLookupPhone(
  phoneRaw: string,
  seasonId?: string | null,
): Promise<RegistrantLookupRegistrationRow[]> {
  const phoneDigits = normalizeRegistrantLookupPhone(phoneRaw);
  if (phoneDigits.length < 10) return [];

  const { phoneKeys } = await loadDistinctLookupFieldKeys();
  const orConditions = buildPhoneLookupOr(phoneDigits, phoneKeys);
  const rows = await prisma.registration.findMany({
    where: {
      ...registrantLookupRegistrationWhereForSeason(seasonId),
      OR: orConditions.length > 0 ? orConditions : undefined,
    },
    include: registrantLookupRegistrationInclude,
    orderBy: { registeredAt: "desc" },
    take: 200,
  });
  return rows.filter((row) => registrationMatchesLookupPhone(row, phoneDigits));
}

export function isValidLookupEmailFieldKey(
  def: FormDefinitionV1,
  fieldKey: string | null | undefined,
): boolean {
  const key = fieldKey?.trim();
  if (!key) return true;
  if (key === DEFAULT_REGISTRANT_LOOKUP_EMAIL_FIELD) return true;
  const field = def.fields.find((f) => f.key === key);
  if (!field || field.type === "sectionHeader" || field.type === "staticText") return false;
  return field.type === "email" || field.type === "text";
}

export function isValidLookupPhoneFieldKey(
  def: FormDefinitionV1,
  fieldKey: string | null | undefined,
): boolean {
  const key = fieldKey?.trim();
  if (!key) return true;
  if (key === DEFAULT_REGISTRANT_LOOKUP_PHONE_FIELD) return true;
  const field = def.fields.find((f) => f.key === key);
  if (!field || field.type === "sectionHeader" || field.type === "staticText") return false;
  return field.type === "tel" || field.type === "text";
}

export function listLookupEmailFieldOptions(def: FormDefinitionV1): Array<{
  key: string;
  label: string;
  audience: "guardian" | "eachChild" | "consent";
}> {
  const audiences: Array<"guardian" | "eachChild" | "consent"> = ["guardian", "consent", "eachChild"];
  const out: Array<{ key: string; label: string; audience: "guardian" | "eachChild" | "consent" }> = [];
  for (const audience of audiences) {
    for (const field of def.fields) {
      const section = def.sections.find((s) => s.id === field.sectionId);
      if (section?.audience !== audience) continue;
      if (field.type === "sectionHeader" || field.type === "staticText") continue;
      if (field.type === "email" || field.type === "text" || field.key === DEFAULT_REGISTRANT_LOOKUP_EMAIL_FIELD) {
        out.push({ key: field.key, label: field.label, audience });
      }
    }
  }
  return out;
}

export function listLookupPhoneFieldOptions(def: FormDefinitionV1): Array<{
  key: string;
  label: string;
  audience: "guardian" | "eachChild" | "consent";
}> {
  const audiences: Array<"guardian" | "eachChild" | "consent"> = ["guardian", "consent", "eachChild"];
  const out: Array<{ key: string; label: string; audience: "guardian" | "eachChild" | "consent" }> = [];
  for (const audience of audiences) {
    for (const field of def.fields) {
      const section = def.sections.find((s) => s.id === field.sectionId);
      if (section?.audience !== audience) continue;
      if (field.type === "sectionHeader" || field.type === "staticText") continue;
      if (field.type === "tel" || field.type === "text" || field.key === DEFAULT_REGISTRANT_LOOKUP_PHONE_FIELD) {
        out.push({ key: field.key, label: field.label, audience });
      }
    }
  }
  return out;
}

export function submissionMatchesLookupEmail(args: {
  emailNormalized: string;
  form: {
    registrantLookupEmailFieldKey?: string | null;
    registrantLookupPhoneFieldKey?: string | null;
    publishedDefinitionJson?: string | null;
    draftDefinitionJson?: string | null;
  } | null;
  guardian: { email?: string | null; phone?: string | null };
  guardianResponses: Record<string, unknown>;
  registrations: Array<{
    customResponses: unknown;
    child: { guardian: { email?: string | null; phone?: string | null } };
  }>;
}): boolean {
  const config = lookupFieldConfigFromForm(args.form);
  const definition =
    getEffectiveDefinition(
      {
        publishedDefinitionJson: args.form?.publishedDefinitionJson ?? null,
        draftDefinitionJson: args.form?.draftDefinitionJson ?? null,
      },
      false,
    ) ?? createDefaultFormDefinition();

  const submissionEmail = readLookupFieldValue({
    fieldKey: config.emailFieldKey,
    definition,
    guardian: args.guardian,
    guardianResponses: args.guardianResponses,
    customResponses: {},
  });
  if (lookupEmailMatches(submissionEmail, args.emailNormalized)) return true;

  return args.registrations.some((reg) => {
    const customResponses = (reg.customResponses as Record<string, unknown> | null) ?? {};
    const email = readLookupFieldValue({
      fieldKey: config.emailFieldKey,
      definition,
      guardian: reg.child.guardian,
      guardianResponses: args.guardianResponses,
      customResponses,
    });
    return lookupEmailMatches(email, args.emailNormalized);
  });
}
