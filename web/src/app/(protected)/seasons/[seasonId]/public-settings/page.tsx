import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageDirectory } from "@/lib/roles";
import { clampRegistrationBackgroundDimmingPercent } from "@/lib/registration-background-scrim";
import { rulesFromDb } from "@/lib/public-registration";
import { redirect, notFound } from "next/navigation";
import { PublicRegistrationSettingsForm } from "./settings-form";

type PageProps = { params: Promise<{ seasonId: string }> };

export default async function PublicRegistrationSettingsPage({ params }: PageProps) {
  const { seasonId } = await params;
  const session = await auth();
  if (!session?.user?.role) redirect("/login");
  if (!canManageDirectory(session.user.role)) redirect("/seasons");

  const season = await prisma.vbsSeason.findUnique({
    where: { id: seasonId },
    include: { publicRegistrationSettings: true },
  });
  if (!season) notFound();

  const rules = rulesFromDb(season.publicRegistrationSettings);
  const welcome = season.publicRegistrationSettings?.welcomeMessage ?? "";

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-foreground/60">
          <Link href="/seasons" className="hover:underline">
            ← Seasons
          </Link>
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Public registration</h1>
        <p className="mt-1 text-foreground/70">
          {season.name} ({season.year}) — control the parent-facing form at{" "}
          <code className="rounded bg-foreground/10 px-1.5 py-0.5 text-sm">/register</code>
        </p>
      </div>

      <PublicRegistrationSettingsForm
        seasonId={season.id}
        publicRegistrationOpen={season.publicRegistrationOpen}
        requireGuardianEmail={rules.requireGuardianEmail}
        requireGuardianPhone={rules.requireGuardianPhone}
        requireAllergiesNotes={rules.requireAllergiesNotes}
        welcomeMessage={welcome}
        registrationBackgroundImageUrl={
          season.publicRegistrationSettings?.registrationBackgroundImageUrl ?? null
        }
        registrationBackgroundDimmingPercent={clampRegistrationBackgroundDimmingPercent(
          season.publicRegistrationSettings?.registrationBackgroundDimmingPercent,
        )}
      />
    </div>
  );
}
