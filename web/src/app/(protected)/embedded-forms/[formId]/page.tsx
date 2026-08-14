import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { canManageDirectory } from "@/lib/roles";
import { getPublicBaseUrl } from "@/lib/public-base-url";
import { EmbeddedFormAdminPanel } from "../embedded-form-admin-panel";
import { parseEmbeddedFormDefinitionJson } from "@/lib/embedded-form-definition";

export default async function EmbeddedFormDetailPage({
  params,
}: {
  params: Promise<{ formId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.role) redirect("/login");
  if (!canManageDirectory(session.user.role)) redirect("/dashboard");

  const { formId } = await params;
  const form = await prisma.embeddedForm.findUnique({
    where: { id: formId },
    include: { _count: { select: { submissions: true } } },
  });
  if (!form) notFound();

  const publicBase = await getPublicBaseUrl();
  const publicUrl = `${publicBase}/forms/${form.slug}`;
  const def =
    parseEmbeddedFormDefinitionJson(form.draftDefinitionJson) ||
    parseEmbeddedFormDefinitionJson(form.publishedDefinitionJson);
  const fieldCount = def?.fields.filter((f) => f.type !== "staticText" && f.type !== "sectionHeader").length ?? 0;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
      <div>
        <Link href="/embedded-forms" className="text-sm text-brand hover:underline">
          ← Embedded Forms
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{form.title}</h1>
        {form.subtitle ? <p className="text-foreground/60">{form.subtitle}</p> : null}
        <div className="mt-2 flex flex-wrap gap-3 text-sm text-foreground/55">
          <span>Status: {form.status}</span>
          <span>Fields: {fieldCount}</span>
          <Link href={`/embedded-forms/${form.id}/submissions`} className="text-brand hover:underline">
            Submissions ({form._count.submissions})
          </Link>
        </div>
      </div>

      <EmbeddedFormAdminPanel
        formId={form.id}
        title={form.title}
        subtitle={form.subtitle ?? ""}
        slug={form.slug}
        status={form.status}
        welcomeMessage={form.welcomeMessage ?? ""}
        confirmationMessage={form.confirmationMessage ?? ""}
        instructions={form.instructions ?? ""}
        emailFromName={form.emailFromName ?? ""}
        emailSubject={form.emailSubject ?? ""}
        helpEmail={form.helpEmail ?? ""}
        helpPhone={form.helpPhone ?? ""}
        applicationNumberPrefix={form.applicationNumberPrefix ?? ""}
        pdfTemplateKey={form.pdfTemplateKey ?? ""}
        publicUrl={publicUrl}
        publishedVersion={form.publishedVersion}
      />

      <div className="rounded-xl border border-foreground/10 bg-surface-elevated p-4 text-sm text-foreground/65">
        <p className="font-medium text-foreground">Template fields</p>
        <p className="mt-1">
          This form uses a fixed published template definition ({fieldCount} fillable / structural fields).
          Publishing promotes the current draft definition to the public form. The Hebron Theological College
          application ships with every applicant and registrar field preconfigured.
        </p>
      </div>
    </div>
  );
}
