import type { ProgramKind } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { resolvePortalBranding } from "@/lib/portal-branding";
import { getPortalPublicPath } from "@/lib/portal-public-path";
import { getPublicAppBaseUrl } from "@/lib/public-app-url";

export type RegistrationEmailContext = {
  eventName: string;
  brandName: string;
  helpEmail: string;
  participantSingularLabel: string;
  participantPluralLabel: string;
  teamPhrase: string;
  registerUrl: string;
  isLegacyVbs: boolean;
  programKind: ProgramKind;
  teamReviewNote: string;
};

function envHelpEmail(): string {
  return process.env.VBS_HELP_EMAIL?.trim() || "vbs@ipchouston.com";
}

export function pluralizeParticipantLabel(label: string): string {
  const lower = label.trim().toLowerCase();
  if (!lower) return "participants";
  if (lower === "child") return "children";
  if (lower.endsWith("s")) return lower;
  return `${lower}s`;
}

export async function loadRegistrationEmailContext(
  seasonId: string,
): Promise<RegistrationEmailContext | null> {
  const season = await prisma.vbsSeason.findUnique({
    where: { id: seasonId },
    include: { publicRegistrationSettings: true },
  });
  if (!season) return null;

  const isLegacyVbs = !season.publicRegistrationSlug?.trim() && season.programKind === "VBS";
  const branding = resolvePortalBranding(season, season.publicRegistrationSettings, {
    legacyVbsDefaults: isLegacyVbs,
  });
  const helpEmail = branding.contactEmail.trim() || envHelpEmail();
  const eventName = season.name.trim() || "this event";

  return {
    eventName,
    brandName: branding.headerLabel.trim() || eventName,
    helpEmail,
    participantSingularLabel: branding.participantSingularLabel,
    participantPluralLabel: pluralizeParticipantLabel(branding.participantSingularLabel),
    teamPhrase: `the ${eventName} team`,
    registerUrl: `${getPublicAppBaseUrl()}${getPortalPublicPath(season)}`,
    isLegacyVbs,
    programKind: season.programKind,
    teamReviewNote: isLegacyVbs
      ? branding.teamReviewNote
      : `Thank you — we have received your registration for ${eventName}. Someone from our team will review your details and confirm your enrollment. If anything else is needed, we will reach out using the contact information you provided.`,
  };
}

export function paymentDeadlineNoticeText(ctx: RegistrationEmailContext): string {
  if (ctx.isLegacyVbs) {
    return "To finalize your child's VBS registration, payment must be received by the first day of VBS. Unfortunately unpaid registrations will not be eligible to attend VBS or receive a VBS t-shirt.";
  }
  const who = ctx.participantSingularLabel.toLowerCase();
  return `To finalize your registration for ${ctx.eventName}, payment must be received by the first day of the event. Unpaid registrations may not be eligible to attend or participate as a registered ${who}.`;
}
