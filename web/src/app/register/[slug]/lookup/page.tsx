import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ensureRegistrationFormForSeason, isFormRegistrationOpen } from "@/lib/ensure-registration-form";
import { prisma } from "@/lib/prisma";
import { clampRegistrationBackgroundDimmingPercent } from "@/lib/registration-background-scrim";
import { calendarDateFromDate } from "@/lib/season-calendar-date";
import { normalizePortalSlug } from "@/lib/portal-public-path";
import { resolvePortalBranding } from "@/lib/portal-branding";
import {
  RegistrantLookupPageShell,
  type RegistrantLookupPageDisplay,
} from "@/app/register/lookup/registrant-lookup-page-shell";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug: raw } = await params;
  const slug = normalizePortalSlug(raw);
  if (!slug) return { title: "Find your registration" };
  const season = await prisma.vbsSeason.findFirst({
    where: { publicRegistrationSlug: slug },
    include: { publicRegistrationSettings: true },
  });
  if (!season) return { title: "Find your registration" };
  const branding = resolvePortalBranding(season, season.publicRegistrationSettings, { legacyVbsDefaults: false });
  return {
    title: `Find your registration | ${branding.headerLabel}`,
    description: branding.pageDescription,
  };
}

function fallbackDisplay(headerLabel: string): RegistrantLookupPageDisplay {
  return {
    churchDisplayName: "IPC Hebron",
    headerLabel,
    contactEmail: process.env.VBS_HELP_EMAIL?.trim() ?? "vbs@ipchouston.com",
    contactPhone: process.env.NEXT_PUBLIC_VBS_CONTACT_PHONE?.trim() ?? "",
    formTitle: null,
    seasonName: null,
    seasonId: null,
    registerPath: null,
    welcomeMessage: null,
    startDate: null,
    endDate: null,
    sessionTimeDescription: null,
    helpContactEmail: null,
    helpContactName: null,
    backgroundImageUrl: null,
    backgroundVideoUrl: null,
    backgroundDimmingPercent: clampRegistrationBackgroundDimmingPercent(undefined),
    lookupEnabled: false,
    registrationOpen: false,
  };
}

export default async function PortalRegistrantLookupPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug: raw } = await params;
  const slug = normalizePortalSlug(raw);
  if (!slug) notFound();

  let display = fallbackDisplay("Registration lookup");

  try {
    const season = await prisma.vbsSeason.findFirst({
      where: { publicRegistrationSlug: slug },
      include: { publicRegistrationSettings: true, registrationForm: true },
    });
    if (!season) notFound();

    const branding = resolvePortalBranding(season, season.publicRegistrationSettings, {
      legacyVbsDefaults: false,
    });
    const formRow =
      season.registrationForm ?? (await ensureRegistrationFormForSeason(season.id, season.name));
    const settings = season.publicRegistrationSettings;
    const registrationOpen =
      season.publicRegistrationOpen &&
      formRow.status === "PUBLISHED" &&
      isFormRegistrationOpen(formRow);

    display = {
      churchDisplayName: branding.churchDisplayName,
      headerLabel: branding.headerLabel,
      contactEmail: branding.contactEmail,
      contactPhone: branding.contactPhone,
      formTitle: formRow.title,
      seasonName: season.name,
      seasonId: season.id,
      registerPath: `/register/${slug}`,
      welcomeMessage: formRow.welcomeMessage ?? settings?.welcomeMessage ?? null,
      startDate: calendarDateFromDate(season.startDate),
      endDate: calendarDateFromDate(season.endDate),
      sessionTimeDescription: settings?.sessionTimeDescription?.trim() || null,
      helpContactEmail: branding.contactEmail,
      helpContactName: branding.contactName || null,
      backgroundImageUrl: settings?.registrationBackgroundImageUrl ?? null,
      backgroundVideoUrl: settings?.registrationBackgroundVideoUrl ?? null,
      backgroundDimmingPercent: clampRegistrationBackgroundDimmingPercent(
        settings?.registrationBackgroundDimmingPercent,
      ),
      lookupEnabled: formRow.registrantLookupEnabled === true,
      registrationOpen,
    };
  } catch (err) {
    console.error("[register/slug/lookup] failed to load season display", err);
  }

  if (!display.lookupEnabled) notFound();

  return <RegistrantLookupPageShell display={display} />;
}
