import {
  findRegistrationsForLookupEmail,
  findRegistrationsForLookupPhone,
  registrantLookupRegistrationInclude,
  registrationLookupEmail,
  registrationMatchesLookupEmail,
} from "@/lib/registrant-lookup-fields";
import {
  maskRegistrantLookupEmail,
  normalizeRegistrantLookupEmail,
  normalizeRegistrantLookupPhone,
  registrantLookupRegistrationWhere,
  type RegistrantLookupEmailOption,
} from "@/lib/registrant-lookup";
import { prisma } from "@/lib/prisma";

function childLabel(firstName: string, lastName: string): string {
  const n = `${firstName} ${lastName}`.trim();
  return n || "Child";
}

/** Resolve the configured email field for a registration or family submission code. */
export async function resolveEmailForRegistrationNumberLookup(
  code: string,
): Promise<{ emailNormalized: string; registrationCode: string } | null> {
  const trimmed = code.trim();
  if (!trimmed) return null;

  const reg = await prisma.registration.findFirst({
    where: {
      ...registrantLookupRegistrationWhere,
      OR: [
        { registrationNumber: { equals: trimmed, mode: "insensitive" } },
        { formSubmission: { registrationCode: { equals: trimmed, mode: "insensitive" } } },
      ],
    },
    include: registrantLookupRegistrationInclude,
    orderBy: { registeredAt: "desc" },
  });

  if (!reg) return null;

  const email = registrationLookupEmail(reg).trim();
  if (!email) return null;

  return {
    emailNormalized: normalizeRegistrantLookupEmail(email),
    registrationCode: trimmed,
  };
}

/** Distinct emails on active registrations matching a phone number via the configured phone field. */
export async function findEmailOptionsForPhoneLookup(
  phoneRaw: string,
): Promise<RegistrantLookupEmailOption[]> {
  const registrations = await findRegistrationsForLookupPhone(phoneRaw);
  const byEmail = new Map<string, Set<string>>();

  for (const reg of registrations) {
    const email = registrationLookupEmail(reg).trim();
    if (!email) continue;
    const normalized = normalizeRegistrantLookupEmail(email);
    const names = byEmail.get(normalized) ?? new Set<string>();
    names.add(childLabel(reg.child.firstName, reg.child.lastName));
    byEmail.set(normalized, names);
  }

  return [...byEmail.entries()].map(([emailNormalized, names]) => ({
    emailNormalized,
    maskedEmail: maskRegistrantLookupEmail(emailNormalized),
    childSummary: [...names].slice(0, 4).join(", "),
  }));
}

/** Ensure the email belongs to an active registration with the given phone on the configured fields. */
export async function emailMatchesPhoneForLookup(
  emailNormalized: string,
  phoneRaw: string,
): Promise<boolean> {
  const phoneDigits = normalizeRegistrantLookupPhone(phoneRaw);
  if (phoneDigits.length < 10) return false;

  const phoneMatches = await findRegistrationsForLookupPhone(phoneRaw);
  return phoneMatches.some((reg) => registrationMatchesLookupEmail(reg, emailNormalized));
}

export { findRegistrationsForLookupEmail };
