import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import Link from "next/link";
import {
  ensureRegistrationFormForSeason,
  getEffectiveDefinition,
  isFormRegistrationOpen,
} from "@/lib/ensure-registration-form";
import { prisma } from "@/lib/prisma";
import { clampRegistrationBackgroundDimmingPercent } from "@/lib/registration-background-scrim";
import { parsePublicRegistrationLayout } from "@/lib/public-registration-layout";
import { rulesFromDb } from "@/lib/public-registration";
import { parseWaiverMergeFieldKeysFromDb, parseWaiverSupplementalDefsFromDb } from "@/lib/waiver-merge-fields";
import { DynamicRegistrationWizard, type PublicSeasonWaiverSnapshot } from "./dynamic-registration-wizard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Register for VBS | IPC Hebron",
  description: "Sign up your children for Vacation Bible School",
  openGraph: {
    title: "Register for VBS | IPC Hebron",
    description: "Sign up your children for Vacation Bible School",
    images: [{ url: "/vbsthemelogo.webp", alt: "IPC Hebron VBS" }],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/vbsthemelogo.webp"],
  },
};

const CHURCH_DISPLAY_NAME = "IPC Hebron";

export default async function PublicRegisterPage({
  searchParams,
}: {
  searchParams?: Promise<{ payment?: string; season?: string }>;
}) {
  const sp = searchParams ? await searchParams : {};
  const paymentCanceled = sp.payment === "canceled";
  const canceledSeasonId = typeof sp.season === "string" ? sp.season.trim() : "";

  type SeasonRow = Awaited<ReturnType<typeof prisma.vbsSeason.findMany<{
    include: { publicRegistrationSettings: true; registrationForm: true };
  }>>>[number];
  let seasons: SeasonRow[] = [];
  let dbUnavailable = false;
  try {
    seasons = await prisma.vbsSeason.findMany({
      where: { publicRegistrationOpen: true },
      orderBy: [{ year: "desc" }, { startDate: "desc" }],
      include: { publicRegistrationSettings: true, registrationForm: true },
    });
  } catch (err) {
    dbUnavailable = true;
    console.error("[register page] failed to load seasons", err);
  }

  const options = [];
  const waiverBySeasonId: Record<string, PublicSeasonWaiverSnapshot> = {};
  for (const s of seasons) {
    const formRow = s.registrationForm ?? (await ensureRegistrationFormForSeason(s.id, s.name));
    if (formRow.status !== "PUBLISHED") continue;
    if (!isFormRegistrationOpen(formRow)) continue;

    waiverBySeasonId[s.id] = {
      enabled: formRow.waiverEnabled === true,
      title: formRow.waiverTitle,
      description: formRow.waiverDescription,
      body: formRow.waiverBody,
      mergeFieldKeys: parseWaiverMergeFieldKeysFromDb(formRow.waiverMergeFieldKeys),
      supplementalFields: parseWaiverSupplementalDefsFromDb(formRow.waiverSupplementalFields),
    };

    options.push({
      id: s.id,
      name: s.name,
      year: s.year,
      startDate: s.startDate.toISOString(),
      endDate: s.endDate.toISOString(),
      welcomeMessage: formRow.welcomeMessage ?? s.publicRegistrationSettings?.welcomeMessage ?? null,
      backgroundImageUrl:
        s.publicRegistrationSettings?.registrationBackgroundImageUrl ?? null,
      backgroundVideoUrl:
        s.publicRegistrationSettings?.registrationBackgroundVideoUrl ?? null,
      backgroundLayout: parsePublicRegistrationLayout(
        s.publicRegistrationSettings?.registrationBackgroundLayout,
      ),
      backgroundDimmingPercent: clampRegistrationBackgroundDimmingPercent(
        s.publicRegistrationSettings?.registrationBackgroundDimmingPercent,
      ),
      rules: rulesFromDb(s.publicRegistrationSettings),
      formTitle: formRow.title,
      definition: getEffectiveDefinition(formRow, false),
      minimumParticipantAgeYears: formRow.minimumParticipantAgeYears,
      maximumParticipantAgeYears: formRow.maximumParticipantAgeYears,
      stripeCheckoutEnabled: formRow.stripeCheckoutEnabled,
      stripeAmountCents: formRow.stripeAmountCents,
      stripePricingUnit: formRow.stripePricingUnit,
      stripeProcessingFeeMode: formRow.stripeProcessingFeeMode,
      stripeProductLabel: formRow.stripeProductLabel,
      stripeSkipWhenFieldKey: formRow.stripeSkipWhenFieldKey,
      stripeSkipWhenFieldValue: formRow.stripeSkipWhenFieldValue,
      sessionTimeDescription: s.publicRegistrationSettings?.sessionTimeDescription?.trim() || null,
      waiverEnabled: formRow.waiverEnabled,
      waiverTitle: formRow.waiverTitle,
      waiverDescription: formRow.waiverDescription,
      waiverBody: formRow.waiverBody,
      waiverMergeFieldKeys: parseWaiverMergeFieldKeysFromDb(formRow.waiverMergeFieldKeys),
      waiverSupplementalFields: parseWaiverSupplementalDefsFromDb(formRow.waiverSupplementalFields),
    });
  }

  const contactEmail = process.env.NEXT_PUBLIC_VBS_CONTACT_EMAIL?.trim() ?? "";
  const contactPhone = process.env.NEXT_PUBLIC_VBS_CONTACT_PHONE?.trim() ?? "";
  const clientSubmitKey = randomUUID();

  return (
    <div className="min-h-full bg-background">
      <header className="border-b border-neutral-200/80 bg-white/90 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/90">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-100">{CHURCH_DISPLAY_NAME} VBS</p>
          <Link
            href="/login"
            className="text-xs font-medium text-neutral-500 underline-offset-4 hover:text-neutral-800 hover:underline dark:text-neutral-400 dark:hover:text-neutral-200"
          >
            Staff sign in
          </Link>
        </div>
      </header>

      <div className="px-4 pb-16 pt-8 sm:pb-12 sm:pt-10">
        {dbUnavailable ? (
          <div className="mx-auto mb-4 max-w-6xl rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
            Registration is temporarily unavailable because the database connection timed out. Please try again in a
            minute.
          </div>
        ) : null}
        <DynamicRegistrationWizard
          seasons={options}
          waiverBySeasonId={waiverBySeasonId}
          clientSubmitKey={clientSubmitKey}
          contactEmail={contactEmail}
          contactPhone={contactPhone}
          churchDisplayName={CHURCH_DISPLAY_NAME}
          paymentCanceled={paymentCanceled}
          initialSeasonId={canceledSeasonId || undefined}
        />
      </div>

      <footer className="border-t border-neutral-200/80 bg-white/80 py-6 text-center text-xs text-neutral-500 dark:border-neutral-800 dark:bg-neutral-950/80 dark:text-neutral-400">
        <p className="mx-auto max-w-md px-4">
          Secure registration — your information is used only for this VBS event.{" "}
          {contactEmail || contactPhone ? (
            <>
              Questions?{" "}
              {contactEmail ? (
                <a href={`mailto:${contactEmail}`} className="font-medium text-brand underline">
                  {contactEmail}
                </a>
              ) : null}
              {contactEmail && contactPhone ? " · " : null}
              {contactPhone ? (
                <a href={`tel:${contactPhone.replace(/\D/g, "")}`} className="font-medium text-brand underline">
                  {contactPhone}
                </a>
              ) : null}
            </>
          ) : (
            <>Contact the church office for assistance.</>
          )}
        </p>
      </footer>
    </div>
  );
}
