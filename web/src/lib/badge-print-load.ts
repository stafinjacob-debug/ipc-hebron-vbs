import { prisma } from "@/lib/prisma";
import {
  buildBadgePrintPayload,
  resolveBadgePrintSettings,
  type BadgePrintPayload,
} from "@/lib/badge-print";
import { badgePrintableFormFieldOptions } from "@/lib/registration-export";
import { registrationTicketUrl } from "@/lib/registration-identity";
import { getPublicAppBaseUrl } from "@/lib/public-app-url";
import QRCode from "qrcode";

export type BadgePrintLoadResult =
  | { ok: true; payload: BadgePrintPayload }
  | { ok: false; status: number; error: string };

function absolutizeAssetUrl(url: string | null, baseUrl: string): string | null {
  const trimmed = url?.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith("data:")) {
    return trimmed;
  }
  const base = baseUrl.replace(/\/$/, "");
  return trimmed.startsWith("/") ? `${base}${trimmed}` : `${base}/${trimmed}`;
}

export async function loadBadgePrintPayloadForRegistration(
  registrationId: string,
): Promise<BadgePrintLoadResult> {
  const reg = await prisma.registration.findUnique({
    where: { id: registrationId },
    include: {
      child: { include: { guardian: true } },
      season: {
        include: {
          badgePrintSettings: true,
          registrationForm: {
            select: { publishedDefinitionJson: true, draftDefinitionJson: true },
          },
        },
      },
      classroom: true,
      formSubmission: {
        select: { registrationCode: true, guardianResponses: true },
      },
    },
  });

  if (!reg) {
    return { ok: false, status: 404, error: "Registration not found" };
  }

  const settings = resolveBadgePrintSettings(reg.season.badgePrintSettings);
  if (!settings.enabled) {
    return {
      ok: false,
      status: 403,
      error: "Badge printing is disabled for this season.",
    };
  }

  const baseUrl = getPublicAppBaseUrl();
  const formJson =
    reg.season.registrationForm?.publishedDefinitionJson ??
    reg.season.registrationForm?.draftDefinitionJson;
  const fieldOptions = badgePrintableFormFieldOptions(formJson);

  let qrDataUrl: string | null = null;
  if (settings.showQrCode && reg.checkInToken) {
    const ticketUrl = registrationTicketUrl(reg.checkInToken, baseUrl, reg.season);
    qrDataUrl = await QRCode.toDataURL(ticketUrl, {
      width: 240,
      margin: 1,
      color: { dark: "#0f172a", light: "#ffffff" },
    });
  }

  const payload = buildBadgePrintPayload({
    settings: {
      ...settings,
      logoUrl: absolutizeAssetUrl(settings.logoUrl, baseUrl),
    },
    registrationId: reg.id,
    childFirstName: reg.child.firstName,
    childLastName: reg.child.lastName,
    childDateOfBirth: reg.child.dateOfBirth,
    allergiesNotes: reg.child.allergiesNotes,
    registrationNumber: reg.registrationNumber,
    submissionCode: reg.formSubmission?.registrationCode ?? null,
    staffNotes: reg.notes,
    guardianFirstName: reg.child.guardian.firstName,
    guardianLastName: reg.child.guardian.lastName,
    guardianPhone: reg.child.guardian.phone,
    checkInToken: reg.checkInToken,
    publicRegistrationSlug: reg.season.publicRegistrationSlug,
    seasonName: reg.season.name,
    seasonYear: reg.season.year,
    classroomName: reg.classroom?.name ?? null,
    badgeDisplayName: reg.classroom?.badgeDisplayName ?? null,
    checkInLabel: reg.classroom?.checkInLabel ?? null,
    qrDataUrl,
    fieldOptions,
    registrationRow: {
      id: reg.id,
      registrationNumber: reg.registrationNumber,
      status: reg.status,
      registeredAt: reg.registeredAt,
      notes: reg.notes,
      customResponses: reg.customResponses,
      child: reg.child,
      classroom: reg.classroom,
      formSubmission: reg.formSubmission,
    },
  });

  return { ok: true, payload };
}
