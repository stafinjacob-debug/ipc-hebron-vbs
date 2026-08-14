"use server";

import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { parseEmbeddedFormDefinitionJson, embeddedDefinitionToJson } from "@/lib/embedded-form-definition";
import { parseEmbeddedApplicantForm } from "@/lib/embedded-form-validate";
import { storeEmbeddedCandidatePhoto } from "@/lib/embedded-photo-storage";
import { storeEmbeddedAcademicDocuments } from "@/lib/embedded-document-storage";
import { issueEmbeddedApplicationNumber } from "@/lib/ensure-embedded-form";
import { sendEmbeddedApplicationReceivedEmail } from "@/lib/email/embedded-application-email";
import { createEmbeddedApplicationStripeCheckout } from "@/lib/embedded-stripe-payment";
import { Prisma } from "@/generated/prisma";

export type PublicEmbeddedSubmitResult =
  | {
      ok: true;
      applicationNumber: string;
      submissionId: string;
      stripeCheckoutUrl?: string;
    }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export async function submitEmbeddedFormPublic(
  slug: string,
  formData: FormData,
): Promise<PublicEmbeddedSubmitResult> {
  const form = await prisma.embeddedForm.findUnique({ where: { slug } });
  if (!form || form.status !== "PUBLISHED" || !form.publishedDefinitionJson) {
    return { ok: false, error: "This application form is not currently accepting submissions." };
  }

  const def = parseEmbeddedFormDefinitionJson(form.publishedDefinitionJson);
  if (!def) return { ok: false, error: "Form configuration is invalid. Please contact admissions." };

  const clientSubmitKey = String(formData.get("clientSubmitKey") ?? "").trim() || null;
  const stripeRequired =
    form.stripeCheckoutEnabled && (form.stripeAmountCents ?? 0) >= 50;

  if (clientSubmitKey) {
    const existing = await prisma.embeddedFormSubmission.findUnique({
      where: { formId_clientSubmitKey: { formId: form.id, clientSubmitKey } },
    });
    if (existing) {
      if (
        stripeRequired &&
        existing.stripePaymentStatus !== "paid" &&
        (form.stripeAmountCents ?? 0) >= 50
      ) {
        const checkout = await createEmbeddedApplicationStripeCheckout({
          submissionId: existing.id,
          formSlug: form.slug,
          applicantEmail: existing.applicantEmail,
          productLabel:
            form.stripeProductLabel?.trim() ||
            `${form.title} — Application Fee`,
          baseCents: form.stripeAmountCents!,
          includeProcessingFee: form.stripeIncludeProcessingFee,
        });
        if ("error" in checkout) {
          return {
            ok: false,
            error: `${checkout.error} Your reference is ${existing.applicationNumber}.`,
          };
        }
        return {
          ok: true,
          applicationNumber: existing.applicationNumber,
          submissionId: existing.id,
          stripeCheckoutUrl: checkout.url,
        };
      }
      return {
        ok: true,
        applicationNumber: existing.applicationNumber,
        submissionId: existing.id,
      };
    }
  }

  const parsed = parseEmbeddedApplicantForm(def, formData);
  if (!parsed.ok) {
    return { ok: false, error: parsed.error, fieldErrors: parsed.fieldErrors };
  }

  const photoFile = formData.get("passportPhoto");
  if (!(photoFile instanceof File) || photoFile.size <= 0) {
    return {
      ok: false,
      error: "Please upload a passport photo.",
      fieldErrors: { passportPhoto: "Please upload a passport photo." },
    };
  }

  const academicFiles = formData
    .getAll("academicDocuments")
    .filter((x): x is File => x instanceof File && x.size > 0);
  if (academicFiles.length === 0) {
    return {
      ok: false,
      error: "Please upload at least one academic document.",
      fieldErrors: { academicDocuments: "Please upload at least one academic document." },
    };
  }

  if (stripeRequired && !process.env.STRIPE_SECRET_KEY?.trim()) {
    return {
      ok: false,
      error: "Card payment is required but Stripe is not configured. Please contact admissions.",
    };
  }

  const applicationNumber = await issueEmbeddedApplicationNumber(form.id);
  const provisionalId = randomUUID();

  const photoResult = await storeEmbeddedCandidatePhoto(photoFile, form.id, provisionalId);
  if (!photoResult.ok) {
    return { ok: false, error: photoResult.error, fieldErrors: { passportPhoto: photoResult.error } };
  }

  const docsResult = await storeEmbeddedAcademicDocuments(academicFiles, form.id, provisionalId);
  if (!docsResult.ok) {
    return {
      ok: false,
      error: docsResult.error,
      fieldErrors: { academicDocuments: docsResult.error },
    };
  }

  const signedAt = parsed.signatureDate ? new Date(parsed.signatureDate) : new Date();
  const documentKeys = docsResult.documents.map((d) => d.objectKey);

  try {
    const submission = await prisma.embeddedFormSubmission.create({
      data: {
        id: provisionalId,
        formId: form.id,
        applicationNumber,
        clientSubmitKey,
        formVersion: form.publishedVersion,
        status: "PENDING_REVIEW",
        applicantFullName: parsed.applicantFullName,
        applicantEmail: parsed.applicantEmail,
        applicantPhone: parsed.applicantPhone,
        responsesJson: parsed.responses as Prisma.InputJsonValue,
        definitionSnapshotJson: embeddedDefinitionToJson(def),
        photoObjectKey: photoResult.photo.objectKey,
        photoContentType: photoResult.photo.contentType,
        academicDocumentKeys: documentKeys,
        signatureTypedName: parsed.signatureTypedName,
        signedAt: Number.isNaN(signedAt.getTime()) ? new Date() : signedAt,
        declarationAccepted: parsed.declarationAccepted,
        receivedAt: new Date(),
        stripePaymentStatus: stripeRequired ? "pending" : null,
        stripeBaseCents: stripeRequired ? form.stripeAmountCents : null,
      },
    });

    if (stripeRequired) {
      const checkout = await createEmbeddedApplicationStripeCheckout({
        submissionId: submission.id,
        formSlug: form.slug,
        applicantEmail: submission.applicantEmail,
        productLabel:
          form.stripeProductLabel?.trim() || `${form.title} — Application Fee`,
        baseCents: form.stripeAmountCents!,
        includeProcessingFee: form.stripeIncludeProcessingFee,
      });
      if ("error" in checkout) {
        return {
          ok: false,
          error: `${checkout.error} Your application was saved as ${submission.applicationNumber}. Please contact admissions to complete payment.`,
        };
      }
      return {
        ok: true,
        applicationNumber: submission.applicationNumber,
        submissionId: submission.id,
        stripeCheckoutUrl: checkout.url,
      };
    }

    void sendEmbeddedApplicationReceivedEmail(submission.id).catch((err) => {
      console.error("[embedded submit email]", err);
    });

    return {
      ok: true,
      applicationNumber: submission.applicationNumber,
      submissionId: submission.id,
    };
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002" &&
      clientSubmitKey
    ) {
      const existing = await prisma.embeddedFormSubmission.findUnique({
        where: { formId_clientSubmitKey: { formId: form.id, clientSubmitKey } },
      });
      if (existing) {
        return {
          ok: true,
          applicationNumber: existing.applicationNumber,
          submissionId: existing.id,
        };
      }
    }
    console.error("[embedded submit]", e);
    return { ok: false, error: "Could not save your application. Please try again." };
  }
}
