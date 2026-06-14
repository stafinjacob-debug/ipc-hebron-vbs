import QRCode from "qrcode";
import { buildPublicTicketUrl } from "@/lib/portal-public-path";
import { getPublicAppBaseUrl } from "@/lib/public-app-url";

export type RegistrationTicketPortal = {
  publicRegistrationSlug: string | null | undefined;
};

export function registrationTicketUrl(
  checkInToken: string,
  baseUrl?: string,
  season?: RegistrationTicketPortal,
): string {
  const base = baseUrl ?? getPublicAppBaseUrl();
  return buildPublicTicketUrl(base, season ?? { publicRegistrationSlug: null }, checkInToken);
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
