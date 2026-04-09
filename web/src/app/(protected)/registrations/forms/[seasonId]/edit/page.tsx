import { auth } from "@/auth";
import { ensureRegistrationFormForSeason, getEffectiveDefinition } from "@/lib/ensure-registration-form";
import { createDefaultFormDefinition } from "@/lib/registration-form-definition";
import { prisma } from "@/lib/prisma";
import { canManageDirectory, canViewOperations } from "@/lib/roles";
import { notFound, redirect } from "next/navigation";
import { FormDefinitionEditor } from "./form-definition-editor";

export default async function RegistrationFormEditPage({
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
      <p className="text-sm text-foreground/70">Only coordinators can edit the form definition.</p>
    );
  }

  const season = await prisma.vbsSeason.findUnique({ where: { id: seasonId } });
  if (!season) notFound();

  let form = await prisma.registrationForm.findUnique({ where: { seasonId } });
  if (!form) {
    form = await ensureRegistrationFormForSeason(season.id, season.name);
  }

  const def = getEffectiveDefinition(form, true) ?? createDefaultFormDefinition();

  return <FormDefinitionEditor seasonId={seasonId} initialDefinition={def} />;
}
