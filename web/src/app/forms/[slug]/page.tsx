import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { parseEmbeddedFormDefinitionJson } from "@/lib/embedded-form-definition";
import { ensureHtcEmbeddedForm } from "@/lib/ensure-embedded-form";
import { HTC_FORM_DEFAULTS } from "@/lib/embedded-form-htc-template";
import { computeProcessingGrossUp } from "@/lib/stripe-fee-math";
import { EmbeddedPublicWizard } from "./embedded-public-wizard";

export default async function PublicEmbeddedFormPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (slug === HTC_FORM_DEFAULTS.slug) {
    await ensureHtcEmbeddedForm();
  }

  const form = await prisma.embeddedForm.findUnique({ where: { slug } });
  if (!form || form.status !== "PUBLISHED" || !form.publishedDefinitionJson) notFound();

  const definition = parseEmbeddedFormDefinitionJson(form.publishedDefinitionJson);
  if (!definition) notFound();

  const stripeFeePreview =
    form.stripeCheckoutEnabled && (form.stripeAmountCents ?? 0) >= 50
      ? computeProcessingGrossUp(form.stripeAmountCents!, form.stripeIncludeProcessingFee)
      : null;

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-indigo-50/40">
      <EmbeddedPublicWizard
        slug={form.slug}
        title={form.title}
        subtitle={form.subtitle}
        welcomeMessage={form.welcomeMessage}
        confirmationMessage={form.confirmationMessage}
        definition={definition}
        helpEmail={form.helpEmail}
        helpPhone={form.helpPhone}
        stripeCheckoutEnabled={form.stripeCheckoutEnabled}
        stripeAmountCents={form.stripeAmountCents}
        stripeIncludeProcessingFee={form.stripeIncludeProcessingFee}
        stripeFeePreview={stripeFeePreview}
      />
    </main>
  );
}
