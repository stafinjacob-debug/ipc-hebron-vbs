import { randomBytes } from "crypto";
import QRCode from "qrcode";
import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { getPublicAppBaseUrl } from "@/lib/public-app-url";

type DbClient = Prisma.TransactionClient | typeof prisma;

export function makeCheckInToken(): string {
  return randomBytes(18).toString("hex");
}

function clampSeqDigits(n: number): number {
  if (!Number.isFinite(n)) return 3;
  return Math.min(8, Math.max(2, Math.floor(n)));
}

function legacyRandomRegistrationNumber(seasonYear: number, db: DbClient): Promise<string> {
  return allocateLegacyRandomOnce(seasonYear, db, 12);
}

async function allocateLegacyRandomOnce(
  seasonYear: number,
  db: DbClient,
  attemptsLeft: number,
): Promise<string> {
  if (attemptsLeft <= 0) {
    throw new Error("Could not allocate a unique registration number.");
  }
  const suffix = randomBytes(4).toString("hex").toUpperCase();
  const num = `VBS-${seasonYear}-${suffix}`;
  const clash = await db.registration.findUnique({
    where: { registrationNumber: num },
    select: { id: true },
  });
  if (!clash) return num;
  return allocateLegacyRandomOnce(seasonYear, db, attemptsLeft - 1);
}

/**
 * Issues a unique `registrationNumber` for this season.
 * If the season’s registration form has a non-empty `registrationNumberPrefix`, uses
 * `{prefix}{zeroPaddedSeq}` and bumps the form’s counter. Otherwise uses `VBS-{year}-{random}`.
 */
export async function makeUniqueRegistrationNumber(
  params: { seasonId: string; seasonYear: number },
  db: DbClient = prisma,
): Promise<string> {
  const form = await db.registrationForm.findUnique({
    where: { seasonId: params.seasonId },
    select: {
      id: true,
      registrationNumberPrefix: true,
      registrationNumberSeqDigits: true,
    },
  });

  const prefix = form?.registrationNumberPrefix?.trim() ?? "";
  if (!prefix || !form) {
    return legacyRandomRegistrationNumber(params.seasonYear, db);
  }

  const prefixOk = /^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(prefix);
  if (!prefixOk || prefix.length > 32) {
    return legacyRandomRegistrationNumber(params.seasonYear, db);
  }

  for (let i = 0; i < 24; i++) {
    const updated = await db.registrationForm.update({
      where: { id: form.id },
      data: { registrationNumberNextSeq: { increment: 1 } },
      select: {
        registrationNumberNextSeq: true,
        registrationNumberPrefix: true,
        registrationNumberSeqDigits: true,
      },
    });

    const p = (updated.registrationNumberPrefix ?? "").trim();
    if (!p) {
      return legacyRandomRegistrationNumber(params.seasonYear, db);
    }

    const digits = clampSeqDigits(updated.registrationNumberSeqDigits);
    const seq = updated.registrationNumberNextSeq;
    const num = `${p}${String(seq).padStart(digits, "0")}`;

    const clash = await db.registration.findUnique({
      where: { registrationNumber: num },
      select: { id: true },
    });
    if (!clash) return num;
  }

  throw new Error("Could not allocate a unique registration number.");
}

export function registrationTicketUrl(checkInToken: string, baseUrl?: string): string {
  const b = (baseUrl ?? getPublicAppBaseUrl()).replace(/\/$/, "");
  return `${b}/register/ticket?t=${encodeURIComponent(checkInToken)}`;
}

/** PNG bytes for a scannable check-in / ticket URL. */
export async function qrPngBufferForTicketUrl(ticketUrl: string): Promise<Buffer> {
  return QRCode.toBuffer(ticketUrl, {
    type: "png",
    width: 280,
    margin: 2,
    errorCorrectionLevel: "M",
    color: { dark: "#0f172a", light: "#ffffff" },
  });
}

export async function qrPngBase64ForTicketUrl(ticketUrl: string): Promise<string> {
  const buf = await qrPngBufferForTicketUrl(ticketUrl);
  return buf.toString("base64");
}
