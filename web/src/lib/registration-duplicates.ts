import { prisma } from "@/lib/prisma";
import type { RegistrationStatus } from "@/generated/prisma";

export type DuplicateRegistrationEntry = {
  id: string;
  registrationNumber: string | null;
  status: RegistrationStatus;
  registeredAt: Date;
  seasonId: string;
  seasonName: string;
  guardianEmail: string | null;
  childFirstName: string;
  childLastName: string;
};

export type DuplicateRegistrationGroup = {
  fingerprint: string;
  guardianEmail: string;
  childName: string;
  seasonId: string;
  seasonName: string;
  registrations: DuplicateRegistrationEntry[];
};

function normalizeEmail(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function duplicateFingerprint(seasonId: string, email: string, firstName: string, lastName: string): string {
  return `${seasonId}|${normalizeEmail(email)}|${normalizeName(firstName)}|${normalizeName(lastName)}`;
}

/**
 * Finds groups of active registrations in the same season that share guardian email + child name.
 */
export async function findDuplicateRegistrationGroups(options?: {
  seasonId?: string;
  limit?: number;
}): Promise<DuplicateRegistrationGroup[]> {
  const where = {
    status: { not: "CANCELLED" as RegistrationStatus },
    ...(options?.seasonId ? { seasonId: options.seasonId } : {}),
  };

  const rows = await prisma.registration.findMany({
    where,
    orderBy: { registeredAt: "desc" },
    select: {
      id: true,
      registrationNumber: true,
      status: true,
      registeredAt: true,
      seasonId: true,
      season: { select: { name: true } },
      child: {
        select: {
          firstName: true,
          lastName: true,
          guardian: { select: { email: true } },
        },
      },
    },
  });

  const byKey = new Map<string, DuplicateRegistrationEntry[]>();

  for (const r of rows) {
    const email = normalizeEmail(r.child.guardian.email);
    if (!email) continue;

    const fp = duplicateFingerprint(r.seasonId, email, r.child.firstName, r.child.lastName);
    const entry: DuplicateRegistrationEntry = {
      id: r.id,
      registrationNumber: r.registrationNumber,
      status: r.status,
      registeredAt: r.registeredAt,
      seasonId: r.seasonId,
      seasonName: r.season.name,
      guardianEmail: r.child.guardian.email,
      childFirstName: r.child.firstName,
      childLastName: r.child.lastName,
    };

    const list = byKey.get(fp) ?? [];
    list.push(entry);
    byKey.set(fp, list);
  }

  const groups: DuplicateRegistrationGroup[] = [];
  for (const [fingerprint, registrations] of byKey) {
    if (registrations.length < 2) continue;
    const first = registrations[0]!;
    groups.push({
      fingerprint,
      guardianEmail: first.guardianEmail ?? "",
      childName: `${first.childFirstName} ${first.childLastName}`.trim(),
      seasonId: first.seasonId,
      seasonName: first.seasonName,
      registrations: registrations.sort((a, b) => b.registeredAt.getTime() - a.registeredAt.getTime()),
    });
  }

  groups.sort((a, b) => b.registrations.length - a.registrations.length);

  const limit = options?.limit ?? 100;
  return groups.slice(0, limit);
}

export async function countDuplicateRegistrationGroups(seasonId?: string): Promise<number> {
  const groups = await findDuplicateRegistrationGroups({ seasonId, limit: 10_000 });
  return groups.length;
}
