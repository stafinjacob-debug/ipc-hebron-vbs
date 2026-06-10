import Link from "next/link";
import { auth } from "@/auth";
import { ensureRegistrationFormForSeason } from "@/lib/ensure-registration-form";
import { prisma } from "@/lib/prisma";
import { canManageDirectory } from "@/lib/roles";
import { clampRegistrationBackgroundDimmingPercent } from "@/lib/registration-background-scrim";
import { parsePublicRegistrationLayout } from "@/lib/public-registration-layout";
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

  const form = await ensureRegistrationFormForSeason(season.id, season.name);

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
        registrantLookupEnabled={form.registrantLookupEnabled}
        seasonStartDate={season.startDate}
        seasonEndDate={season.endDate}
        sessionTimeDescription={season.publicRegistrationSettings?.sessionTimeDescription ?? null}
        helpContactEmail={season.publicRegistrationSettings?.helpContactEmail ?? null}
        registrationBackgroundImageUrl={
          season.publicRegistrationSettings?.registrationBackgroundImageUrl ?? null
        }
        registrationBackgroundVideoUrl={
          season.publicRegistrationSettings?.registrationBackgroundVideoUrl ?? null
        }
        registrationBackgroundDimmingPercent={clampRegistrationBackgroundDimmingPercent(
          season.publicRegistrationSettings?.registrationBackgroundDimmingPercent,
        )}
        registrationBackgroundLayout={parsePublicRegistrationLayout(
          season.publicRegistrationSettings?.registrationBackgroundLayout,
        )}
      />
    </div>
  );
}
