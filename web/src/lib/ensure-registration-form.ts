import { prisma } from "@/lib/prisma";
import {
  createDefaultFormDefinition,
  definitionToJson,
  parseFormDefinitionJson,
} from "@/lib/registration-form-definition";

/**
 * Ensures a RegistrationForm row exists for the season (idempotent).
 * New rows are created as PUBLISHED with the default field template so /register keeps working.
 */
export async function ensureRegistrationFormForSeason(seasonId: string, seasonName: string) {
  const existing = await prisma.registrationForm.findUnique({
    where: { seasonId },
    include: { season: { include: { publicRegistrationSettings: true } } },
  });
  if (existing) return existing;

  const pr = await prisma.publicRegistrationSettings.findUnique({ where: { seasonId } });
  const def = createDefaultFormDefinition();
  const json = definitionToJson(def);

  return prisma.registrationForm.create({
    data: {
      seasonId,
      title: `${seasonName} — VBS registration`,
      welcomeMessage: pr?.welcomeMessage ?? null,
      confirmationMessage:
        "Thank you — your registration was received. The church office may follow up to confirm details.",
      status: "PUBLISHED",
      draftDefinitionJson: json,
      publishedDefinitionJson: json,
      publishedVersion: 1,
      publishedAt: new Date(),
    },
    include: { season: { include: { publicRegistrationSettings: true } } },
  });
}

export function isFormRegistrationOpen(form: {
  registrationOpensAt: Date | null;
  registrationClosesAt: Date | null;
}): boolean {
  const now = Date.now();
  if (form.registrationOpensAt && form.registrationOpensAt.getTime() > now) return false;
  if (form.registrationClosesAt && form.registrationClosesAt.getTime() < now) return false;
  return true;
}

export async function countActiveRegistrationsForSeason(seasonId: string): Promise<number> {
  return prisma.registration.count({
    where: {
      seasonId,
      status: { notIn: ["CANCELLED"] },
    },
  });
}

export function getEffectiveDefinition(
  form: { publishedDefinitionJson: string | null; draftDefinitionJson: string | null },
  useDraft: boolean,
) {
  const raw = useDraft ? form.draftDefinitionJson : form.publishedDefinitionJson;
  const parsed = parseFormDefinitionJson(raw);
  if (parsed) return parsed;
  return createDefaultFormDefinition();
}
