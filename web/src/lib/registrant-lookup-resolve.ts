import { prisma } from "@/lib/prisma";
import {
  maskRegistrantLookupEmail,
  normalizeRegistrantLookupEmail,
  normalizeRegistrantLookupPhone,
  registrantLookupRegistrationForEmail,
  registrantLookupRegistrationWhere,
  type RegistrantLookupEmailOption,
} from "@/lib/registrant-lookup";

function childLabel(firstName: string, lastName: string): string {
  const n = `${firstName} ${lastName}`.trim();
  return n || "Child";
}

/** Resolve guardian email for a registration or family submission code. */
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
    include: {
      child: { include: { guardian: true } },
      formSubmission: { select: { registrationCode: true } },
    },
    orderBy: { registeredAt: "desc" },
  });

  const email = reg?.child.guardian.email?.trim();
  if (!reg || !email) return null;

  return {
    emailNormalized: normalizeRegistrantLookupEmail(email),
    registrationCode: trimmed,
  };
}

/** Distinct guardian emails on active registrations matching a phone number. */
export async function findEmailOptionsForPhoneLookup(
  phoneRaw: string,
): Promise<RegistrantLookupEmailOption[]> {
  const digits = normalizeRegistrantLookupPhone(phoneRaw);
  if (digits.length < 10) return [];

  const registrations = await prisma.registration.findMany({
    where: {
      ...registrantLookupRegistrationWhere,
      child: {
        guardian: {
          phone: { contains: digits },
        },
      },
    },
    include: {
      child: { include: { guardian: true } },
    },
    orderBy: { registeredAt: "desc" },
    take: 100,
  });

  const byEmail = new Map<string, Set<string>>();

  for (const reg of registrations) {
    const email = reg.child.guardian.email?.trim();
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

/** Ensure the email belongs to an active registration with the given phone. */
export async function emailMatchesPhoneForLookup(
  emailNormalized: string,
  phoneRaw: string,
): Promise<boolean> {
  const digits = normalizeRegistrantLookupPhone(phoneRaw);
  if (digits.length < 10) return false;

  const reg = await prisma.registration.findFirst({
    where: {
      ...registrantLookupRegistrationForEmail(emailNormalized),
      child: {
        guardian: {
          phone: { contains: digits },
        },
      },
    },
    select: { id: true },
  });
  return Boolean(reg);
}
