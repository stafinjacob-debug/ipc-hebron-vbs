import type { ProgramKind } from "@/generated/prisma";
import { ensureRegistrationFormForSeason } from "@/lib/ensure-registration-form";
import { resolvePaymentDeadlineNotice } from "@/lib/pay-later";
import { prisma } from "@/lib/prisma";
import { resolvePortalBranding } from "@/lib/portal-branding";
import { getPortalPublicPath, isLegacyVbsPortal } from "@/lib/portal-public-path";
import { getPublicAppBaseUrl } from "@/lib/public-app-url";
import { resolveTicketEmailHeroUrl } from "@/lib/registration-ticket-display";

export type RegistrationEmailContext = {
  eventName: string;
  brandName: string;
  helpEmail: string;
  helpPhone: string;
  churchDisplayName: string;
  /** Custom “Questions?” footer from public registration settings. */
  contactFooterText: string | null;
  participantSingularLabel: string;
  participantPluralLabel: string;
  teamPhrase: string;
  registerUrl: string;
  isLegacyVbs: boolean;
  programKind: ProgramKind;
  teamReviewNote: string;
  paymentDeadlineNotice: string;
  /** Admin override from form settings; when set, payment deadline copy is shown in emails. */
  customPaymentDeadlineNotice: string | null;
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
    include: { publicRegistrationSettings: true, registrationForm: true },
  });
  if (!season) return null;

  const form =
    season.registrationForm ?? (await ensureRegistrationFormForSeason(season.id, season.name));
  const customPaymentDeadlineNotice = form.stripePaymentDeadlineNotice?.trim() || null;

  const isLegacyVbs = isLegacyVbsPortal(season);
  const branding = resolvePortalBranding(season, season.publicRegistrationSettings, {
    legacyVbsDefaults: isLegacyVbs,
  });
  const contactFooterText =
    season.publicRegistrationSettings?.publicContactFooterText?.trim() ||
    branding.contactFooterText?.trim() ||
    null;
  const helpEmail =
    branding.contactEmail.trim() || (isLegacyVbs ? envHelpEmail() : "");
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
    helpPhone: branding.contactPhone.trim(),
    churchDisplayName: branding.churchDisplayName.trim() || "IPC Hebron",
    contactFooterText,
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
      customPaymentDeadlineNotice,
    ),
    customPaymentDeadlineNotice,
  };
}

export function paymentDeadlineNoticeText(ctx: RegistrationEmailContext): string {
  return ctx.paymentDeadlineNotice;
}

/** Sender display name for registration-related Graph mail. */
export function registrationEmailFromName(
  ctx: Pick<RegistrationEmailContext, "eventName" | "brandName">,
): string {
  return ctx.eventName.trim() || ctx.brandName.trim();
}

export function registrationContactFooterInput(
  ctx: Pick<
    RegistrationEmailContext,
    "contactFooterText" | "helpEmail" | "helpPhone" | "churchDisplayName"
  >,
) {
  return {
    contactFooterText: ctx.contactFooterText,
    contactEmail: ctx.helpEmail,
    contactPhone: ctx.helpPhone,
    churchDisplayName: ctx.churchDisplayName,
  };
}
