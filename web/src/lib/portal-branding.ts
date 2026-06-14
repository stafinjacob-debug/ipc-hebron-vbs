import type { PublicRegistrationSettings, VbsSeason } from "@/generated/prisma";

export type PortalBranding = {
  pageTitle: string;
  pageDescription: string;
  headerLabel: string;
  footerNote: string;
  logoUrl: string | null;
  churchDisplayName: string;
  contactEmail: string;
  contactPhone: string;
  /** Custom “Questions?” footer; when empty, email/phone/church fallback is used. */
  contactFooterText: string | null;
  contactSectionLabel: string;
  participantSectionLabel: string;
  participantSingularLabel: string;
  sessionPickerLabel: string;
  teamReviewNote: string;
};

const CHURCH_DISPLAY_NAME = "IPC Hebron";
const DEFAULT_HELP_EMAIL = "vbs@ipchouston.com";

const VBS_DEFAULTS: PortalBranding = {
  pageTitle: "Register for VBS | IPC Hebron",
  pageDescription: "Sign up your children for Vacation Bible School",
  headerLabel: "IPC Hebron VBS",
  footerNote: "Secure registration — your information is used only for this VBS event.",
  logoUrl: "/vbsthemelogo.webp",
  churchDisplayName: CHURCH_DISPLAY_NAME,
  contactEmail: DEFAULT_HELP_EMAIL,
  contactPhone: "",
  contactFooterText: null,
  contactSectionLabel: "Parent / guardian",
  participantSectionLabel: "Children attending VBS",
  participantSingularLabel: "Child",
  sessionPickerLabel: "VBS session",
  teamReviewNote:
    "Thank you — we have received your registration. Someone from our team will review your details and confirm your enrollment. If anything else is needed, we will reach out using the contact information you provided.",
};

type SettingsSlice = Pick<
  PublicRegistrationSettings,
  | "publicPageTitle"
  | "publicPageDescription"
  | "publicHeaderLabel"
  | "publicFooterNote"
  | "publicLogoUrl"
  | "helpContactEmail"
  | "helpContactPhone"
  | "publicContactFooterText"
  | "contactSectionLabel"
  | "participantSectionLabel"
  | "participantSingularLabel"
  | "sessionPickerLabel"
> | null;

export function resolvePortalBranding(
  season: Pick<VbsSeason, "name">,
  settings: SettingsSlice,
  opts?: { legacyVbsDefaults?: boolean },
): PortalBranding {
  const legacy = opts?.legacyVbsDefaults !== false && !settings?.publicHeaderLabel?.trim();
  const base: PortalBranding = legacy
    ? VBS_DEFAULTS
    : {
        ...VBS_DEFAULTS,
        pageTitle: `${season.name} | Registration`,
        pageDescription: `Register for ${season.name}`,
        headerLabel: season.name,
        footerNote: `Secure registration — your information is used only for ${season.name}.`,
        logoUrl: null,
        contactEmail: "",
        contactSectionLabel: "Contact information",
        participantSectionLabel: "Participants",
        participantSingularLabel: "Participant",
        sessionPickerLabel: "Session",
      };

  const contactEmail = legacy
    ? settings?.helpContactEmail?.trim() ||
      process.env.NEXT_PUBLIC_VBS_CONTACT_EMAIL?.trim() ||
      process.env.VBS_HELP_EMAIL?.trim() ||
      DEFAULT_HELP_EMAIL
    : settings?.helpContactEmail?.trim() || "";
  const contactPhone =
    settings?.helpContactPhone?.trim() ||
    (legacy ? process.env.NEXT_PUBLIC_VBS_CONTACT_PHONE?.trim() : "") ||
    "";

  return {
    pageTitle: settings?.publicPageTitle?.trim() || base.pageTitle,
    pageDescription: settings?.publicPageDescription?.trim() || base.pageDescription,
    headerLabel: settings?.publicHeaderLabel?.trim() || base.headerLabel,
    footerNote: settings?.publicFooterNote?.trim() || base.footerNote,
    logoUrl: settings?.publicLogoUrl?.trim() || (legacy ? base.logoUrl : null),
    churchDisplayName: CHURCH_DISPLAY_NAME,
    contactEmail,
    contactPhone,
    contactFooterText: settings?.publicContactFooterText?.trim() || null,
    contactSectionLabel: settings?.contactSectionLabel?.trim() || base.contactSectionLabel,
    participantSectionLabel: settings?.participantSectionLabel?.trim() || base.participantSectionLabel,
    participantSingularLabel: settings?.participantSingularLabel?.trim() || base.participantSingularLabel,
    sessionPickerLabel: settings?.sessionPickerLabel?.trim() || base.sessionPickerLabel,
    teamReviewNote:
      legacy
        ? VBS_DEFAULTS.teamReviewNote
        : `Thank you — we have received your registration for ${season.name}. Someone from our team will review your details and confirm your enrollment. If anything else is needed, we will reach out using the contact information you provided.`,
  };
}

export function legacyVbsBranding(): PortalBranding {
  return {
    ...VBS_DEFAULTS,
    contactEmail:
      process.env.NEXT_PUBLIC_VBS_CONTACT_EMAIL?.trim() ||
      process.env.VBS_HELP_EMAIL?.trim() ||
      DEFAULT_HELP_EMAIL,
    contactPhone: process.env.NEXT_PUBLIC_VBS_CONTACT_PHONE?.trim() ?? "",
  };
}
