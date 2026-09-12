import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { parseEmbeddedFormDefinitionJson } from "@/lib/embedded-form-definition";
import { ensureHtcEmbeddedForm } from "@/lib/ensure-embedded-form";
import { HTC_FORM_DEFAULTS } from "@/lib/embedded-form-htc-template";
import { computeProcessingGrossUp } from "@/lib/stripe-fee-math";
import { EmbeddedPublicWizard } from "./embedded-public-wizard";

const HEBRON_SHARE_IMAGE = {
  url: "/hebron-forms-og.png",
  width: 1200,
  height: 630,
  alt: "IPC Hebron Houston",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  if (slug === HTC_FORM_DEFAULTS.slug) {
    await ensureHtcEmbeddedForm();
  }
  const form = await prisma.embeddedForm.findUnique({
    where: { slug },
    select: { title: true, subtitle: true, status: true },
  });
  if (!form || form.status !== "PUBLISHED") {
    return { title: "Application" };
  }
  const description =
    form.subtitle?.trim() || "IPC Hebron Houston application form";
  return {
    title: form.title,
    description,
    openGraph: {
      title: form.title,
      description,
      type: "website",
      images: [HEBRON_SHARE_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title: form.title,
      description,
      images: [HEBRON_SHARE_IMAGE.url],
    },
  };
}

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
    <main className="min-h-screen bg-white">
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
