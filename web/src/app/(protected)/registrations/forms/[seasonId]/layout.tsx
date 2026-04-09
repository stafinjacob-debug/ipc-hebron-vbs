import { auth } from "@/auth";
import { ensureRegistrationFormForSeason } from "@/lib/ensure-registration-form";
import { prisma } from "@/lib/prisma";
import { canManageDirectory, canViewOperations } from "@/lib/roles";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { RegistrationFormSubnav } from "./registration-form-subnav";

export default async function RegistrationFormSeasonLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ seasonId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.role) redirect("/login");
  if (!canViewOperations(session.user.role)) redirect("/dashboard");

  const { seasonId } = await params;
  const season = await prisma.vbsSeason.findUnique({ where: { id: seasonId } });
  if (!season) notFound();

  let form = await prisma.registrationForm.findUnique({ where: { seasonId } });
  if (!form && canManageDirectory(session.user.role)) {
    form = await ensureRegistrationFormForSeason(season.id, season.name);
  }

  const submissionCount = await prisma.formSubmission.count({ where: { seasonId } });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-foreground/10 pb-6 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-foreground/50">Registrations</p>
          <nav className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-sm text-foreground/60">
            <Link href="/registrations" className="hover:text-foreground hover:underline">
              Overview
            </Link>
            <span aria-hidden>/</span>
            <Link href="/registrations/forms" className="hover:text-foreground hover:underline">
              Form builder
            </Link>
            <span aria-hidden>/</span>
            <span className="font-medium text-foreground">{season.name}</span>
          </nav>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
            {form?.title ?? `${season.name} — registration`}
          </h1>
          <p className="mt-1 text-sm text-foreground/70">Public signup for this season.</p>
        </div>
      </div>

      <RegistrationFormSubnav seasonId={seasonId} submissionCount={submissionCount} />
      {children}
    </div>
  );
}
