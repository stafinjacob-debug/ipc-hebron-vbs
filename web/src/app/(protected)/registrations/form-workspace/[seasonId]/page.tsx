import { Suspense } from "react";
import { auth } from "@/auth";
import {
  ensureRegistrationFormForSeason,
  getEffectiveDefinition,
} from "@/lib/ensure-registration-form";
import {
  createDefaultFormDefinition,
  fieldsForAudience,
} from "@/lib/registration-form-definition";
import { getPublicBaseUrl } from "@/lib/public-base-url";
import { prisma } from "@/lib/prisma";
import { parsePublicRegistrationLayout } from "@/lib/public-registration-layout";
import { clampRegistrationBackgroundDimmingPercent } from "@/lib/registration-background-scrim";
import { rulesFromDb } from "@/lib/public-registration";
import { parseWaiverMergeFieldKeysFromDb, parseWaiverSupplementalDefsFromDb } from "@/lib/waiver-merge-fields";
import { canManageDirectory, canViewOperations } from "@/lib/roles";
import { notFound, redirect } from "next/navigation";
import { FormWorkspacePageClient } from "./form-workspace-client";

export default async function RegistrationFormWorkspacePage({
  params,
}: {
  params: Promise<{ seasonId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.role) redirect("/login");
  if (!canViewOperations(session.user.role)) redirect("/dashboard");

  const { seasonId } = await params;

  if (!canManageDirectory(session.user.role)) {
    redirect(`/registrations/forms/${seasonId}/preview`);
  }

  const season = await prisma.vbsSeason.findUnique({
    where: { id: seasonId },
    include: { registrationForm: true, publicRegistrationSettings: true },
  });
  if (!season) notFound();

  const form =
    season.registrationForm ?? (await ensureRegistrationFormForSeason(season.id, season.name));

  const initialDefinition = getEffectiveDefinition(form, true) ?? createDefaultFormDefinition();
  const previewDraftDefinition = initialDefinition;
  const previewPublishedDefinition =
    getEffectiveDefinition(form, false) ?? createDefaultFormDefinition();
  const hasPublishedDefinition = !!form.publishedDefinitionJson;

  const publicBase = await getPublicBaseUrl();
  const publicSignupUrl = `${publicBase}/register`;
  const publicRules = rulesFromDb(season.publicRegistrationSettings);
  const publicWelcome = season.publicRegistrationSettings?.welcomeMessage ?? "";
  const paymentConditionFieldOptions = ([
    ...fieldsForAudience(initialDefinition, "guardian").map((f) => ({
      key: f.key,
      label: f.label,
      type: f.type,
      audience: "guardian" as const,
    })),
    ...fieldsForAudience(initialDefinition, "eachChild").map((f) => ({
      key: f.key,
      label: f.label,
      type: f.type,
      audience: "eachChild" as const,
    })),
  ])
    .filter((f) => f.type !== "sectionHeader" && f.type !== "staticText")
    .map(({ key, label, audience }) => ({ key, label, audience }));

  const waiverMergeFieldOptions = ([
    ...fieldsForAudience(initialDefinition, "guardian").map((f) => ({
      key: f.key,
      label: f.label,
      type: f.type,
      audience: "guardian" as const,
    })),
    ...fieldsForAudience(initialDefinition, "consent").map((f) => ({
      key: f.key,
      label: f.label,
      type: f.type,
      audience: "consent" as const,
    })),
    ...fieldsForAudience(initialDefinition, "eachChild").map((f) => ({
      key: f.key,
      label: f.label,
      type: f.type,
      audience: "eachChild" as const,
    })),
  ])
    .filter((f) => f.type !== "sectionHeader" && f.type !== "staticText")
    .map(({ key, label, audience }) => ({ key, label, audience }));

  return (
    <Suspense fallback={<p className="text-sm text-foreground/70">Loading workspace…</p>}>
      <FormWorkspacePageClient
        seasonId={season.id}
        seasonName={season.name}
        year={season.year}
        formTitle={form.title}
        formStatus={form.status}
        publishedVersion={form.publishedVersion}
        initialDefinition={initialDefinition}
        previewDraftDefinition={previewDraftDefinition}
        previewPublishedDefinition={previewPublishedDefinition}
        hasPublishedDefinition={hasPublishedDefinition}
        publicSignupUrl={publicSignupUrl}
        publicDisplayInitial={{
          registrationBackgroundImageUrl:
            season.publicRegistrationSettings?.registrationBackgroundImageUrl ?? null,
          registrationBackgroundVideoUrl:
            season.publicRegistrationSettings?.registrationBackgroundVideoUrl ?? null,
          registrationBackgroundDimmingPercent: clampRegistrationBackgroundDimmingPercent(
            season.publicRegistrationSettings?.registrationBackgroundDimmingPercent,
          ),
          registrationBackgroundLayout: parsePublicRegistrationLayout(
            season.publicRegistrationSettings?.registrationBackgroundLayout,
          ),
          requireGuardianEmail: publicRules.requireGuardianEmail,
          requireGuardianPhone: publicRules.requireGuardianPhone,
          requireAllergiesNotes: publicRules.requireAllergiesNotes,
          welcomeMessage: publicWelcome,
          sessionTimeDescription: season.publicRegistrationSettings?.sessionTimeDescription ?? "",
        }}
        settingsInitial={{
          title: form.title,
          welcomeMessage: form.welcomeMessage,
          instructions: form.instructions,
          confirmationMessage: form.confirmationMessage,
          registrationOpensAt: form.registrationOpensAt?.toISOString() ?? null,
          registrationClosesAt: form.registrationClosesAt?.toISOString() ?? null,
          maxTotalRegistrations: form.maxTotalRegistrations,
          waitlistEnabled: form.waitlistEnabled,
          publicRegistrationOpen: season.publicRegistrationOpen,
          minimumParticipantAgeYears: form.minimumParticipantAgeYears,
          maximumParticipantAgeYears: form.maximumParticipantAgeYears,
          registrationNumberPrefix: form.registrationNumberPrefix,
          registrationNumberSeqDigits: form.registrationNumberSeqDigits,
          registrationNumberLastSeq: form.registrationNumberNextSeq,
          stripeCheckoutEnabled: form.stripeCheckoutEnabled,
          stripeAmountCents: form.stripeAmountCents,
          stripePricingUnit: form.stripePricingUnit,
          stripeProcessingFeeMode: form.stripeProcessingFeeMode,
          stripeProductLabel: form.stripeProductLabel,
          stripeSkipWhenFieldKey: form.stripeSkipWhenFieldKey,
          stripeSkipWhenFieldValue: form.stripeSkipWhenFieldValue,
          waiverEnabled: form.waiverEnabled,
          waiverTitle: form.waiverTitle,
          waiverDescription: form.waiverDescription,
          waiverBody: form.waiverBody,
          waiverMergeFieldKeys: parseWaiverMergeFieldKeysFromDb(form.waiverMergeFieldKeys),
          waiverSupplementalFields: parseWaiverSupplementalDefsFromDb(form.waiverSupplementalFields),
          unassignedClassPickerFieldKeys: parseWaiverMergeFieldKeysFromDb(form.unassignedClassPickerFieldKeys),
          settingsStamp: form.updatedAt.toISOString(),
        }}
        paymentConditionFieldOptions={paymentConditionFieldOptions}
        waiverMergeFieldOptions={waiverMergeFieldOptions}
      />
    </Suspense>
  );
}
