import { prisma } from "@/lib/prisma";
import {
  createHtcApplicationDefinition,
  htcApplicationDefinitionJson,
  HTC_FORM_DEFAULTS,
} from "@/lib/embedded-form-htc-template";
import { embeddedDefinitionToJson } from "@/lib/embedded-form-definition";

export async function ensureHtcEmbeddedForm() {
  const defJson = htcApplicationDefinitionJson();
  const existing = await prisma.embeddedForm.findUnique({
    where: { slug: HTC_FORM_DEFAULTS.slug },
  });

  const stripeDefaults = {
    stripeCheckoutEnabled: true,
    stripeAmountCents: HTC_FORM_DEFAULTS.stripeAmountCents,
    stripeProductLabel: HTC_FORM_DEFAULTS.stripeProductLabel,
    stripeIncludeProcessingFee: true,
    welcomeMessage: HTC_FORM_DEFAULTS.welcomeMessage,
    confirmationMessage: HTC_FORM_DEFAULTS.confirmationMessage,
    instructions: HTC_FORM_DEFAULTS.instructions,
  };

  if (existing) {
    const changed =
      existing.draftDefinitionJson !== defJson ||
      existing.publishedDefinitionJson !== defJson ||
      !existing.stripeCheckoutEnabled ||
      existing.stripeAmountCents !== HTC_FORM_DEFAULTS.stripeAmountCents;
    if (!changed) return existing;
    return prisma.embeddedForm.update({
      where: { id: existing.id },
      data: {
        draftDefinitionJson: defJson,
        publishedDefinitionJson: defJson,
        publishedAt: existing.status === "PUBLISHED" ? new Date() : existing.publishedAt,
        publishedVersion:
          existing.status === "PUBLISHED" && existing.publishedDefinitionJson !== defJson
            ? existing.publishedVersion + 1
            : existing.publishedVersion,
        title: existing.title || HTC_FORM_DEFAULTS.title,
        subtitle: existing.subtitle ?? HTC_FORM_DEFAULTS.subtitle,
        pdfTemplateKey: existing.pdfTemplateKey ?? HTC_FORM_DEFAULTS.pdfTemplateKey,
        ...stripeDefaults,
      },
    });
  }

  return prisma.embeddedForm.create({
    data: {
      title: HTC_FORM_DEFAULTS.title,
      subtitle: HTC_FORM_DEFAULTS.subtitle,
      slug: HTC_FORM_DEFAULTS.slug,
      status: "PUBLISHED",
      emailFromName: HTC_FORM_DEFAULTS.emailFromName,
      emailSubject: HTC_FORM_DEFAULTS.emailSubject,
      helpEmail: HTC_FORM_DEFAULTS.helpEmail,
      helpPhone: HTC_FORM_DEFAULTS.helpPhone,
      draftDefinitionJson: defJson,
      publishedDefinitionJson: defJson,
      publishedAt: new Date(),
      publishedVersion: 1,
      pdfTemplateKey: HTC_FORM_DEFAULTS.pdfTemplateKey,
      applicationNumberPrefix: HTC_FORM_DEFAULTS.applicationNumberPrefix,
      applicationNumberSeqDigits: 3,
      applicationNumberNextSeq: 0,
      ...stripeDefaults,
    },
  });
}

export async function issueEmbeddedApplicationNumber(formId: string): Promise<string> {
  const result = await prisma.$transaction(async (tx) => {
    const form = await tx.embeddedForm.findUnique({ where: { id: formId } });
    if (!form) throw new Error("Embedded form not found");
    const next = form.applicationNumberNextSeq + 1;
    await tx.embeddedForm.update({
      where: { id: formId },
      data: { applicationNumberNextSeq: next },
    });
    const digits = Math.min(8, Math.max(2, form.applicationNumberSeqDigits || 3));
    const prefix = (form.applicationNumberPrefix?.trim() || "APP").toUpperCase();
    const year = new Date().getFullYear();
    const seq = String(next).padStart(digits, "0");
    return `${prefix}-${year}-${seq}`;
  });
  return result;
}

export function refreshHtcDraftDefinitionJson(): string {
  return embeddedDefinitionToJson(createHtcApplicationDefinition());
}
