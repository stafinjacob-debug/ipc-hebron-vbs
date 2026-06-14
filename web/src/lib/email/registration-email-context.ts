import type { ProgramKind } from "@/generated/prisma";
import { resolvePaymentDeadlineNotice } from "@/lib/pay-later";
import { prisma } from "@/lib/prisma";
import { resolvePortalBranding } from "@/lib/portal-branding";
import { getPortalPublicPath } from "@/lib/portal-public-path";
import { getPublicAppBaseUrl } from "@/lib/public-app-url";
import {
  isLegacyVbsPortal,
  resolveTicketEmailHeroUrl,
} from "@/lib/registration-ticket-display";

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
  paymentDeadlineNotice: string;
  /** Event logo or registration hero image for ticket emails (non-VBS). */
  ticketLogoUrl: string | null;
  publicRegistrationSlug: string | null;
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
    include: {
      publicRegistrationSettings: true,
      registrationForm: { select: { stripePaymentDeadlineNotice: true } },
    },
  });
  if (!season) return null;

  const isLegacyVbs = isLegacyVbsPortal(season);
  const branding = resolvePortalBranding(season, season.publicRegistrationSettings, {
    legacyVbsDefaults: isLegacyVbs,
  });
  const helpEmail = branding.contactEmail.trim() || envHelpEmail();
  const eventName = season.name.trim() || "this event";
  const ticketLogoUrl = resolveTicketEmailHeroUrl(
    season,
    season.publicRegistrationSettings,
    branding,
  );

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
    ticketLogoUrl,
    publicRegistrationSlug: season.publicRegistrationSlug,
    teamReviewNote: isLegacyVbs
      ? branding.teamReviewNote
      : `Thank you — we have received your registration for ${eventName}. Someone from our team will review your details and confirm your enrollment. If anything else is needed, we will reach out using the contact information you provided.`,
    paymentDeadlineNotice: resolvePaymentDeadlineNotice(
      {
        eventName,
        participantSingularLabel: branding.participantSingularLabel,
        isLegacyVbs,
      },
      season.registrationForm?.stripePaymentDeadlineNotice,
    ),
  };
}

export function paymentDeadlineNoticeText(ctx: RegistrationEmailContext): string {
  return ctx.paymentDeadlineNotice;
}
