import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";

/** Parse scanned QR text or manual entry into a check-in token or plain search text. */
export function parseCheckInLookupInput(raw: string): {
  checkInToken: string | null;
  plainCode: string | null;
} {
  const trimmed = raw.trim();
  if (!trimmed) return { checkInToken: null, plainCode: null };

  const tokenFromQuery = extractTicketToken(trimmed);
  if (tokenFromQuery) return { checkInToken: tokenFromQuery, plainCode: null };

  if (/^[a-f0-9]{36}$/i.test(trimmed)) {
    return { checkInToken: trimmed.toLowerCase(), plainCode: null };
  }

  return { checkInToken: null, plainCode: trimmed };
}

function extractTicketToken(input: string): string | null {
  const tryUrl = (value: string): string | null => {
    try {
      const url = new URL(value);
      const t = url.searchParams.get("t")?.trim();
      if (t) return t;
      if (url.pathname.includes("/register/ticket") || /\/register\/[^/]+\/ticket/.test(url.pathname)) {
        const match = /[?&]t=([^&]+)/i.exec(value);
        return match?.[1]?.trim() ?? null;
      }
    } catch {
      /* not a URL */
    }
    return null;
  };

  const direct = tryUrl(input);
  if (direct) return direct;

  const embedded = /[?&]t=([a-f0-9]{36})/i.exec(input);
  if (embedded?.[1]) return embedded[1].toLowerCase();

  return null;
}

export type CheckInLookupMatch = {
  id: string;
  studentName: string;
  className: string;
  checkedIn: boolean;
  registrationNumber: string | null;
  submissionCode: string | null;
  guardianName: string | null;
  dateOfBirth: string | null;
  allergiesNotes: string | null;
  registrationStatus: string;
  checkInBlocked?: boolean;
  checkInBlockMessage?: string | null;
};

const CHECK_IN_LOOKUP_INCLUDE = {
  child: { include: { guardian: true } },
  classroom: true,
  formSubmission: { select: { registrationCode: true } },
} as const;

type CheckInRegistrationRow = Prisma.RegistrationGetPayload<{ include: typeof CHECK_IN_LOOKUP_INCLUDE }>;

export function mapRegistrationToCheckInLookupMatch(
  r: CheckInRegistrationRow,
  checkedIn?: boolean,
): CheckInLookupMatch {
  const guardian = r.child.guardian;
  return {
    id: r.id,
    studentName: `${r.child.firstName} ${r.child.lastName}`.trim(),
    className: r.classroom?.name ?? "—",
    checkedIn: checkedIn ?? Boolean(r.checkedInAt),
    registrationNumber: r.registrationNumber,
    submissionCode: r.formSubmission?.registrationCode ?? null,
    guardianName: `${guardian.firstName} ${guardian.lastName}`.trim() || null,
    dateOfBirth: r.child.dateOfBirth.toLocaleDateString("en-US", {
      month: "numeric",
      day: "numeric",
      year: "numeric",
    }),
    allergiesNotes: r.child.allergiesNotes?.trim() || null,
    registrationStatus: r.status,
  };
}

const MAX_CHECK_IN_LOOKUP_RESULTS = 50;

/** Collapse whitespace and repeated dashes so IPC--001 and IPC-001 can match each other. */
export function normalizeCheckInCodeInput(raw: string): string {
  return raw.trim().replace(/\s+/g, "").replace(/-+/g, "-");
}

/** Unique variants to try for registration / submission code equality. */
export function registrationCodeLookupVariants(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  const variants = new Set<string>([trimmed]);
  const collapsed = normalizeCheckInCodeInput(trimmed);
  variants.add(collapsed);

  const noDashes = trimmed.replace(/-/g, "");
  if (noDashes.length >= 2) variants.add(noDashes);

  const prefixDigits = /^([A-Za-z][A-Za-z0-9]*)(?:-+)(\d[\w]*)$/i.exec(collapsed);
  if (prefixDigits) {
    const [, prefix, suffix] = prefixDigits;
    variants.add(`${prefix}-${suffix}`);
    variants.add(`${prefix}--${suffix}`);
    variants.add(`${prefix}${suffix}`);
  }

  return [...variants].filter(Boolean);
}

/** True when input looks like a registration # or family submission code, not a person name. */
export function isLikelyRegistrationOrSubmissionCode(input: string): boolean {
  const trimmed = input.trim();
  if (!trimmed) return false;

  if (/^VBS-[A-Z0-9]+-[A-Z0-9]+$/i.test(trimmed)) return true;
  if (/^VBS-\d{4}-/i.test(trimmed)) return true;
  if (/^\d{2,}$/.test(trimmed)) return true;
  if (/[A-Za-z0-9][A-Za-z0-9_-]*\d{2,}$/.test(trimmed)) return true;
  if (trimmed.includes("--")) return true;
  if (/^[A-Za-z]{2,}[-_]\d/i.test(trimmed)) return true;

  return false;
}

function parseNameTokens(input: string): { first?: string; last?: string; single: string } {
  const parts = input.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return { first: parts[0], last: parts.slice(1).join(" "), single: input.trim() };
  }
  return { single: input.trim() };
}

function registrationOrderBy(): Prisma.RegistrationOrderByWithRelationInput[] {
  return [{ child: { lastName: "asc" } }, { child: { firstName: "asc" } }];
}

function dedupeRegistrations(rows: CheckInRegistrationRow[]): CheckInRegistrationRow[] {
  const seen = new Set<string>();
  const out: CheckInRegistrationRow[] = [];
  for (const row of rows) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
  }
  return out;
}

async function findByExactCodes(
  baseWhere: Prisma.RegistrationWhereInput,
  variants: string[],
): Promise<CheckInRegistrationRow[]> {
  const found: CheckInRegistrationRow[] = [];

  for (const variant of variants) {
    const byNumber = await prisma.registration.findMany({
      where: {
        ...baseWhere,
        registrationNumber: { equals: variant, mode: "insensitive" },
      },
      include: CHECK_IN_LOOKUP_INCLUDE,
      orderBy: registrationOrderBy(),
      take: MAX_CHECK_IN_LOOKUP_RESULTS,
    });
    found.push(...byNumber);

    const bySubmission = await prisma.registration.findMany({
      where: {
        ...baseWhere,
        formSubmission: { registrationCode: { equals: variant, mode: "insensitive" } },
      },
      include: CHECK_IN_LOOKUP_INCLUDE,
      orderBy: registrationOrderBy(),
      take: MAX_CHECK_IN_LOOKUP_RESULTS,
    });
    found.push(...bySubmission);
  }

  return dedupeRegistrations(found);
}

async function findByPartialCode(
  baseWhere: Prisma.RegistrationWhereInput,
  code: string,
): Promise<CheckInRegistrationRow[]> {
  const trimmed = code.trim();
  if (trimmed.length < 2) return [];

  const or: Prisma.RegistrationWhereInput[] = [];

  if (trimmed.length >= 3) {
    or.push({ registrationNumber: { startsWith: trimmed, mode: "insensitive" } });
    or.push({ registrationNumber: { contains: trimmed, mode: "insensitive" } });
    or.push({ formSubmission: { registrationCode: { contains: trimmed, mode: "insensitive" } } });
  }

  if (/^\d{2,}$/.test(trimmed)) {
    or.push({ registrationNumber: { endsWith: trimmed, mode: "insensitive" } });
  }

  const noDashes = trimmed.replace(/-/g, "");
  if (noDashes.length >= 3 && noDashes !== trimmed) {
    or.push({ registrationNumber: { contains: noDashes, mode: "insensitive" } });
  }

  if (or.length === 0) return [];

  return prisma.registration.findMany({
    where: { ...baseWhere, OR: or },
    include: CHECK_IN_LOOKUP_INCLUDE,
    orderBy: registrationOrderBy(),
    take: MAX_CHECK_IN_LOOKUP_RESULTS,
  });
}

async function findByName(
  baseWhere: Prisma.RegistrationWhereInput,
  input: string,
): Promise<CheckInRegistrationRow[]> {
  const tokens = parseNameTokens(input);
  const or: Prisma.RegistrationWhereInput[] = [];

  if (tokens.first && tokens.last) {
    or.push({
      child: {
        AND: [
          { firstName: { contains: tokens.first, mode: "insensitive" } },
          { lastName: { contains: tokens.last, mode: "insensitive" } },
        ],
      },
    });
    or.push({
      child: {
        guardian: {
          AND: [
            { firstName: { contains: tokens.first, mode: "insensitive" } },
            { lastName: { contains: tokens.last, mode: "insensitive" } },
          ],
        },
      },
    });
  }

  or.push({ child: { firstName: { contains: tokens.single, mode: "insensitive" } } });
  or.push({ child: { lastName: { contains: tokens.single, mode: "insensitive" } } });
  or.push({
    child: {
      guardian: {
        OR: [
          { firstName: { contains: tokens.single, mode: "insensitive" } },
          { lastName: { contains: tokens.single, mode: "insensitive" } },
        ],
      },
    },
  });

  return prisma.registration.findMany({
    where: { ...baseWhere, OR: or },
    include: CHECK_IN_LOOKUP_INCLUDE,
    orderBy: registrationOrderBy(),
    take: MAX_CHECK_IN_LOOKUP_RESULTS,
  });
}

export async function findCheckInRegistrationsForInput(
  seasonId: string,
  rawInput: string,
): Promise<CheckInRegistrationRow[]> {
  const parsed = parseCheckInLookupInput(rawInput);
  const baseWhere: Prisma.RegistrationWhereInput = {
    seasonId,
    status: { not: "CANCELLED" },
  };

  if (parsed.checkInToken) {
    const reg = await prisma.registration.findFirst({
      where: { ...baseWhere, checkInToken: parsed.checkInToken },
      include: CHECK_IN_LOOKUP_INCLUDE,
    });
    return reg ? [reg] : [];
  }

  const text = parsed.plainCode?.trim() ?? "";
  if (!text) return [];

  const variants = registrationCodeLookupVariants(text);
  const exact = await findByExactCodes(baseWhere, variants);
  if (exact.length > 0) return exact.slice(0, MAX_CHECK_IN_LOOKUP_RESULTS);

  if (isLikelyRegistrationOrSubmissionCode(text)) {
    const partial = await findByPartialCode(baseWhere, text);
    if (partial.length > 0) return partial;
  }

  if (!isLikelyRegistrationOrSubmissionCode(text) && /[A-Za-z]/.test(text)) {
    const byName = await findByName(baseWhere, text);
    if (byName.length > 0) return byName;
  }

  const qDigits = text.replace(/\D/g, "");
  if (qDigits.length >= 3) {
    const byPhone = await prisma.registration.findMany({
      where: {
        ...baseWhere,
        child: { guardian: { phone: { contains: qDigits } } },
      },
      include: CHECK_IN_LOOKUP_INCLUDE,
      orderBy: registrationOrderBy(),
      take: MAX_CHECK_IN_LOOKUP_RESULTS,
    });
    if (byPhone.length > 0) return byPhone;
  }

  const partial = await findByPartialCode(baseWhere, text);
  if (partial.length > 0) return partial;

  return [];
}
