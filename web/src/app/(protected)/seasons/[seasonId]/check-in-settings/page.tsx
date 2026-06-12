import { auth } from "@/auth";
import { parseCheckInBlockSettings } from "@/lib/check-in-block";
import { prisma } from "@/lib/prisma";
import { formatSeasonDateRange } from "@/lib/season-calendar-date";
import { buildRegistrationExportFieldOptionsFromJson } from "@/lib/registration-export";
import { canManageDirectory, canViewOperations } from "@/lib/roles";
import { ClipboardCheck } from "lucide-react";
import { redirect } from "next/navigation";
import { CheckInSettingsForm } from "./settings-form";

type Props = { params: Promise<{ seasonId: string }> };

export default async function CheckInSettingsPage({ params }: Props) {
  const session = await auth();
  if (!session?.user?.role) redirect("/login");
  if (!canViewOperations(session.user.role)) redirect("/dashboard");
  if (!canManageDirectory(session.user.role)) redirect("/seasons");

  const { seasonId } = await params;
  const season = await prisma.vbsSeason.findUnique({
    where: { id: seasonId },
    include: {
      registrationForm: {
        select: {
          publishedDefinitionJson: true,
          draftDefinitionJson: true,
        },
      },
    },
  });
  if (!season) redirect("/seasons");

  const formJson =
    season.registrationForm?.publishedDefinitionJson ??
    season.registrationForm?.draftDefinitionJson;
  const fieldOptions = buildRegistrationExportFieldOptionsFromJson(formJson);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <ClipboardCheck className="size-7 text-brand" aria-hidden />
          Check-in settings
        </h1>
        <p className="mt-1 text-muted">
          {season.name} ({season.year}) · {formatSeasonDateRange(season.startDate, season.endDate)}
        </p>
      </div>

      <CheckInSettingsForm
        seasonId={season.id}
        seasonName={season.name}
        multiDayCheckInEnabled={season.multiDayCheckInEnabled}
        dismissalTrackingEnabled={season.dismissalTrackingEnabled}
        checkInUndoPin={season.checkInUndoPin}
        checkInBlock={parseCheckInBlockSettings(season.checkInBlockRulesJson)}
        fieldOptions={fieldOptions}
      />
    </div>
  );
}
