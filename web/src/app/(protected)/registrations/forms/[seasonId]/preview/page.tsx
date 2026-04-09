import { auth } from "@/auth";
import { getEffectiveDefinition } from "@/lib/ensure-registration-form";
import { createDefaultFormDefinition } from "@/lib/registration-form-definition";
import { prisma } from "@/lib/prisma";
import { canViewOperations } from "@/lib/roles";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AdminFormPreview } from "./form-preview";

export default async function RegistrationFormPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ seasonId: string }>;
  searchParams: Promise<{ draft?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.role) redirect("/login");
  if (!canViewOperations(session.user.role)) redirect("/dashboard");

  const { seasonId } = await params;
  const sp = await searchParams;
  const useDraft = sp.draft !== "0";

  const season = await prisma.vbsSeason.findUnique({
    where: { id: seasonId },
    include: { registrationForm: true },
  });
  if (!season) notFound();

  const form = season.registrationForm;
  if (!form) {
    return (
      <p className="text-sm text-foreground/70">
        No registration form for this season. Coordinators can initialize it from the{" "}
        <Link href="/registrations/forms" className="underline">
          list
        </Link>
        .
      </p>
    );
  }

  const def = getEffectiveDefinition(form, useDraft) ?? createDefaultFormDefinition();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="text-foreground/70">Showing:</span>
        <Link
          href={`/registrations/forms/${seasonId}/preview`}
          className={
            useDraft
              ? "font-medium text-brand underline"
              : "text-foreground/80 underline hover:text-foreground"
          }
        >
          Draft definition
        </Link>
        <span className="text-foreground/40">|</span>
        <Link
          href={`/registrations/forms/${seasonId}/preview?draft=0`}
          className={
            !useDraft
              ? "font-medium text-brand underline"
              : "text-foreground/80 underline hover:text-foreground"
          }
        >
          Published definition
        </Link>
      </div>
      <AdminFormPreview definition={def} formTitle={form.title} seasonName={season.name} />
    </div>
  );
}
