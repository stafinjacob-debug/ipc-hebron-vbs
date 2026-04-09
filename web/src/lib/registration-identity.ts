import { randomBytes } from "crypto";
import QRCode from "qrcode";
import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { getPublicAppBaseUrl } from "@/lib/public-app-url";

type DbClient = Prisma.TransactionClient | typeof prisma;

export function makeCheckInToken(): string {
  return randomBytes(18).toString("hex");
}

export async function makeUniqueRegistrationNumber(
  seasonYear: number,
  db: DbClient = prisma,
): Promise<string> {
  for (let i = 0; i < 12; i++) {
    const suffix = randomBytes(4).toString("hex").toUpperCase();
    const num = `VBS-${seasonYear}-${suffix}`;
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
