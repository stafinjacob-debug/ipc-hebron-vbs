import { auth } from "@/auth";
import { ensureRegistrationFormForSeason } from "@/lib/ensure-registration-form";
import { prisma } from "@/lib/prisma";
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
        }}
      />
    </div>
  );
}
