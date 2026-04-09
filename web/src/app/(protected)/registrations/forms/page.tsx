import { auth } from "@/auth";
import { isFormRegistrationOpen, ensureRegistrationFormForSeason } from "@/lib/ensure-registration-form";
import { prisma } from "@/lib/prisma";
import { canManageDirectory, canViewOperations } from "@/lib/roles";
import Link from "next/link";
import { redirect } from "next/navigation";

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Form builder</h1>
        <p className="mt-1 text-foreground/70">
          One public form per season — pick a row to edit fields, publish, and manage submissions.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-foreground/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-foreground/[0.04] text-foreground/70">
            <tr>
              <th className="px-4 py-3 font-medium">Season</th>
              <th className="px-4 py-3 font-medium">Form status</th>
              <th className="px-4 py-3 font-medium">Public signup</th>
              <th className="px-4 py-3 font-medium">Registration window</th>
              <th className="px-4 py-3 font-medium">Last updated</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ season: s, form }) => {
              if (!form) {
                return (
                  <tr key={s.id} className="border-t border-foreground/10">
                    <td className="px-4 py-3 font-medium">{s.name}</td>
                    <td className="px-4 py-3 text-foreground/50" colSpan={6}>
                      No form record (sign in as coordinator to initialize).
                    </td>
                  </tr>
                );
              }
              const windowOpen = isFormRegistrationOpen(form);
              const live =
                form.status === "PUBLISHED" &&
                windowOpen &&
                s.publicRegistrationOpen &&
                form.publishedDefinitionJson;

              return (
                <tr key={s.id} className="border-t border-foreground/10">
                  <td className="px-4 py-3 font-medium">{s.name}</td>
                  <td className="px-4 py-3">
                    <span className="font-medium">{form.status}</span>
                    {form.publishedVersion ? (
                      <span className="ml-1 text-foreground/60">v{form.publishedVersion}</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    {s.publicRegistrationOpen ? (
                      <span className="text-emerald-600 dark:text-emerald-400">Open</span>
                    ) : (
                      <span className="text-foreground/50">Closed</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-foreground/80">
                    {live ? (
                      <span className="text-emerald-600 dark:text-emerald-400">Accepting responses</span>
                    ) : (
                      <span className="text-foreground/50">Not accepting</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-foreground/70">{form.updatedAt.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-x-3 gap-y-1">
                      <Link
                        href={`/registrations/forms/${s.id}`}
                        className="font-medium text-foreground/90 underline hover:no-underline"
                      >
                        Hub
                      </Link>
                      {canEdit && (
                        <>
                          <Link
                            href={`/registrations/forms/${s.id}/edit`}
                            className="font-medium text-foreground/90 underline hover:no-underline"
                          >
                            Editor
                          </Link>
                          <Link
                            href={`/registrations/forms/${s.id}/settings`}
                            className="font-medium text-foreground/90 underline hover:no-underline"
                          >
                            Settings
                          </Link>
                        </>
                      )}
                      <Link
                        href={`/registrations/forms/${s.id}/preview`}
                        className="font-medium text-foreground/90 underline hover:no-underline"
                      >
                        Preview
                      </Link>
                      <Link
                        href={`/registrations/forms/${s.id}/submissions`}
                        className="font-medium text-foreground/90 underline hover:no-underline"
                      >
                        Submissions
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="px-4 py-8 text-center text-foreground/60">No seasons yet.</p>
        )}
      </div>
    </div>
  );
}
