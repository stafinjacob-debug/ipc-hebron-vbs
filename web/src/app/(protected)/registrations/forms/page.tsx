import { auth } from "@/auth";
import { isFormRegistrationOpen, ensureRegistrationFormForSeason } from "@/lib/ensure-registration-form";
import { getPublicBaseUrl } from "@/lib/public-base-url";
import { prisma } from "@/lib/prisma";
import { canManageDirectory, canViewOperations } from "@/lib/roles";
import { redirect } from "next/navigation";
import { FormBuilderWorkspace, type FormBuilderSeasonRow } from "./form-builder-workspace";

export default async function RegistrationFormsListPage() {
  const session = await auth();
  if (!session?.user?.role) redirect("/login");
  if (!canViewOperations(session.user.role)) redirect("/dashboard");

  const canEdit = canManageDirectory(session.user.role);

  const seasons = await prisma.vbsSeason.findMany({
    orderBy: [{ year: "desc" }, { startDate: "desc" }],
    include: { registrationForm: true },
  });

  const rows = await Promise.all(
    seasons.map(async (s) => {
      if (s.registrationForm) return { season: s, form: s.registrationForm };
      if (!canEdit) return { season: s, form: null as (typeof s)["registrationForm"] };
      const form = await ensureRegistrationFormForSeason(s.id, s.name);
      return { season: s, form };
    }),
  );

  const publicBase = await getPublicBaseUrl();
  const publicSignupUrl = `${publicBase}/register`;

  const workspaceRows: FormBuilderSeasonRow[] = rows.map(({ season: s, form }) => {
    if (!form) {
      return { kind: "no-form" as const, seasonId: s.id, seasonName: s.name };
    }
    const windowOpen = isFormRegistrationOpen(form);
    const acceptingResponses =
      form.status === "PUBLISHED" && windowOpen && s.publicRegistrationOpen && !!form.publishedDefinitionJson;

    return {
      kind: "form" as const,
      seasonId: s.id,
      seasonName: s.name,
      year: s.year,
      formTitle: form.title,
      formStatus: form.status,
      publishedVersion: form.publishedVersion,
      publicRegistrationOpen: s.publicRegistrationOpen,
      acceptingResponses,
      updatedAtIso: form.updatedAt.toISOString(),
      publicSignupUrl,
      canEdit,
    };
  });

  return <FormBuilderWorkspace rows={workspaceRows} canEdit={canEdit} />;
}
