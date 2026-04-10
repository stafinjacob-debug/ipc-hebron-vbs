import { prisma } from "@/lib/prisma";
import { listChildAssignableFieldOptions, parseFormDefinitionJson } from "@/lib/registration-form-definition";

export async function listAssignableChildFieldsForSeason(
  seasonId: string,
): Promise<{ key: string; label: string }[]> {
  const form = await prisma.registrationForm.findUnique({
    where: { seasonId },
    select: { publishedDefinitionJson: true },
  });
  const def = parseFormDefinitionJson(form?.publishedDefinitionJson ?? null);
  if (!def) return [];
  return listChildAssignableFieldOptions(def);
}
