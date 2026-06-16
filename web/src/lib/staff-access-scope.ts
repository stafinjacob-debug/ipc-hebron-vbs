import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";

export type StaffAccessScope = {
  seasonIds: string[];
  classroomIds: string[];
  /** True when at least one season or classroom scope row exists. */
  isRestricted: boolean;
};

export async function loadStaffAccessScope(userId: string): Promise<StaffAccessScope> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      seasonScopes: { select: { seasonId: true } },
      classroomScopes: { select: { classroomId: true } },
    },
  });

  const seasonIds = user?.seasonScopes.map((s) => s.seasonId) ?? [];
  const classroomIds = user?.classroomScopes.map((c) => c.classroomId) ?? [];

  return {
    seasonIds,
    classroomIds,
    isRestricted: seasonIds.length > 0 || classroomIds.length > 0,
  };
}

export function filterSeasonsForStaff<T extends { id: string }>(
  seasons: T[],
  scope: StaffAccessScope,
): T[] {
  if (!scope.isRestricted || scope.seasonIds.length === 0) return seasons;
  const allowed = new Set(scope.seasonIds);
  return seasons.filter((s) => allowed.has(s.id));
}

export function seasonIdAllowed(scope: StaffAccessScope, seasonId: string): boolean {
  if (!scope.isRestricted) return true;
  if (scope.seasonIds.length > 0 && !scope.seasonIds.includes(seasonId)) return false;
  return true;
}

export function registrationAllowedByScope(
  scope: StaffAccessScope,
  reg: { seasonId: string; classroomId: string | null },
): boolean {
  if (!scope.isRestricted) return true;
  if (scope.seasonIds.length > 0 && !scope.seasonIds.includes(reg.seasonId)) return false;
  if (scope.classroomIds.length > 0) {
    if (!reg.classroomId || !scope.classroomIds.includes(reg.classroomId)) return false;
  }
  return true;
}

/** Merge staff scope constraints into a registration list `where` clause. */
export function mergeRegistrationScopeWhere(
  scope: StaffAccessScope,
  where: Prisma.RegistrationWhereInput = {},
): Prisma.RegistrationWhereInput {
  if (!scope.isRestricted) return where;

  const scopeParts: Prisma.RegistrationWhereInput[] = [];
  if (scope.seasonIds.length > 0) {
    scopeParts.push({ seasonId: { in: scope.seasonIds } });
  }
  if (scope.classroomIds.length > 0) {
    scopeParts.push({ classroomId: { in: scope.classroomIds } });
  }
  if (scopeParts.length === 0) return where;

  const scopeWhere: Prisma.RegistrationWhereInput =
    scopeParts.length === 1 ? scopeParts[0]! : { AND: scopeParts };

  if (Object.keys(where).length === 0) return scopeWhere;
  return { AND: [where, scopeWhere] };
}
