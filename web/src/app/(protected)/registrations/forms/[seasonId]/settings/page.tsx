import { auth } from "@/auth";
import { ensureRegistrationFormForSeason } from "@/lib/ensure-registration-form";
import { createDefaultFormDefinition, fieldsForAudience, parseFormDefinitionJson } from "@/lib/registration-form-definition";
import { prisma } from "@/lib/prisma";
import { parseWaiverMergeFieldKeysFromDb, parseWaiverSupplementalDefsFromDb } from "@/lib/waiver-merge-fields";
import { canManageDirectory, canViewOperations } from "@/lib/roles";
import { notFound, redirect } from "next/navigation";
import { FormSettingsForm } from "./form-settings-form";

export default async function RegistrationFormSettingsPage({
  params,
}: {
  params: Promise<{ seasonId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.role) redirect("/login");
  if (!canViewOperations(session.user.role)) redirect("/dashboard");

  const { seasonId } = await params;
  if (!canManageDirectory(session.user.role)) {
    return (
      <p className="text-sm text-foreground/70">You can view this hub, but only coordinators can change settings.</p>
    );
  }

  const season = await prisma.vbsSeason.findUnique({
    where: { id: seasonId },
    include: { registrationForm: true },
  });
  if (!season) notFound();

  const form =
    season.registrationForm ?? (await ensureRegistrationFormForSeason(season.id, season.name));
  const activeDef =
    parseFormDefinitionJson(form.publishedDefinitionJson ?? form.draftDefinitionJson) ??
    createDefaultFormDefinition();
  const paymentConditionFieldOptions = ([
    ...fieldsForAudience(activeDef, "guardian").map((f) => ({
      key: f.key,
      label: f.label,
      type: f.type,
      audience: "guardian" as const,
    })),
    ...fieldsForAudience(activeDef, "eachChild").map((f) => ({
      key: f.key,
      label: f.label,
      type: f.type,
      audience: "eachChild" as const,
    })),
  ])
    .filter((f) => f.type !== "sectionHeader" && f.type !== "staticText")
    .map(({ key, label, audience }) => ({ key, label, audience }));

  const waiverMergeFieldOptions = ([
    ...fieldsForAudience(activeDef, "guardian").map((f) => ({
      key: f.key,
      label: f.label,
      type: f.type,
      audience: "guardian" as const,
    })),
    ...fieldsForAudience(activeDef, "consent").map((f) => ({
      key: f.key,
      label: f.label,
      type: f.type,
      audience: "consent" as const,
    })),
    ...fieldsForAudience(activeDef, "eachChild").map((f) => ({
      key: f.key,
      label: f.label,
      type: f.type,
      audience: "eachChild" as const,
    })),
  ])
    .filter((f) => f.type !== "sectionHeader" && f.type !== "staticText")
    .map(({ key, label, audience }) => ({ key, label, audience }));

  return (
    <div className="space-y-4">
      <p className="text-sm text-foreground/70">
        Background image and field-level rules (require email/phone) stay on{" "}
        <a href={`/seasons/${seasonId}/public-settings`} className="font-medium underline">
          Public registration settings
        </a>
        .
      </p>
      <FormSettingsForm
        key={form.updatedAt.toISOString()}
        seasonId={seasonId}
        initial={{
          title: form.title,
          welcomeMessage: form.welcomeMessage,
          instructions: form.instructions,
          confirmationMessage: form.confirmationMessage,
          registrationOpensAt: form.registrationOpensAt,
          registrationClosesAt: form.registrationClosesAt,
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
    </div>
  );
}
