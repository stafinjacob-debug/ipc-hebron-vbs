"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageDirectory } from "@/lib/roles";
import {
  assertValidEmbeddedDefinition,
  embeddedDefinitionToJson,
  parseEmbeddedFormDefinitionJson,
} from "@/lib/embedded-form-definition";
import { ensureHtcEmbeddedForm } from "@/lib/ensure-embedded-form";
import { parseEmbeddedRegistrarForm } from "@/lib/embedded-form-validate";
import { sendEmbeddedApplicationReceivedEmail } from "@/lib/email/embedded-application-email";
import { Prisma, type EmbeddedFormStatus, type EmbeddedSubmissionStatus } from "@/generated/prisma";

async function requireEmbeddedManager() {
  const session = await auth();
  if (!session?.user?.role || !canManageDirectory(session.user.role)) {
    throw new Error("Unauthorized");
  }
  return session;
}

export async function bootstrapEmbeddedFormsAction(): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireEmbeddedManager();
    await ensureHtcEmbeddedForm();
    revalidatePath("/embedded-forms");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function saveEmbeddedFormSettingsAction(
  formId: string,
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await requireEmbeddedManager();
    const title = String(formData.get("title") ?? "").trim();
    if (!title) return { ok: false, error: "Title is required." };
    const slugRaw = String(formData.get("slug") ?? "").trim().toLowerCase();
    const slug = slugRaw
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);
    if (!slug) return { ok: false, error: "Slug is required." };

    await prisma.embeddedForm.update({
      where: { id: formId },
      data: {
        title,
        subtitle: String(formData.get("subtitle") ?? "").trim() || null,
        slug,
        welcomeMessage: String(formData.get("welcomeMessage") ?? "").trim() || null,
        confirmationMessage: String(formData.get("confirmationMessage") ?? "").trim() || null,
        instructions: String(formData.get("instructions") ?? "").trim() || null,
        emailFromName: String(formData.get("emailFromName") ?? "").trim() || null,
        emailSubject: String(formData.get("emailSubject") ?? "").trim() || null,
        helpEmail: String(formData.get("helpEmail") ?? "").trim() || null,
        helpPhone: String(formData.get("helpPhone") ?? "").trim() || null,
        applicationNumberPrefix: String(formData.get("applicationNumberPrefix") ?? "").trim() || null,
        pdfTemplateKey: String(formData.get("pdfTemplateKey") ?? "").trim() || null,
      },
    });

    await prisma.embeddedFormAuditLog.create({
      data: {
        formId,
        userId: session.user?.id ?? null,
        action: "settings_saved",
      },
    });

    revalidatePath("/embedded-forms");
    revalidatePath(`/embedded-forms/${formId}`);
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to save";
    if (msg.includes("Unique constraint") || msg.toLowerCase().includes("unique")) {
      return { ok: false, error: "That public slug is already in use." };
    }
    return { ok: false, error: msg };
  }
}

export async function saveEmbeddedFormDraftAction(
  formId: string,
  definitionJson: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await requireEmbeddedManager();
    assertValidEmbeddedDefinition(definitionJson);
    await prisma.embeddedForm.update({
      where: { id: formId },
      data: { draftDefinitionJson: definitionJson },
    });
    await prisma.embeddedFormAuditLog.create({
      data: { formId, userId: session.user?.id ?? null, action: "draft_saved" },
    });
    revalidatePath(`/embedded-forms/${formId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Invalid definition" };
  }
}

export async function publishEmbeddedFormAction(
  formId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await requireEmbeddedManager();
    const form = await prisma.embeddedForm.findUnique({ where: { id: formId } });
    if (!form?.draftDefinitionJson) return { ok: false, error: "No draft definition to publish." };
    assertValidEmbeddedDefinition(form.draftDefinitionJson);
    const nextVersion = form.publishedVersion + 1;
    await prisma.embeddedForm.update({
      where: { id: formId },
      data: {
        publishedDefinitionJson: form.draftDefinitionJson,
        publishedAt: new Date(),
        publishedVersion: nextVersion,
        status: "PUBLISHED",
      },
    });
    await prisma.embeddedFormAuditLog.create({
      data: {
        formId,
        userId: session.user?.id ?? null,
        action: "published",
        metadata: { version: nextVersion },
      },
    });
    revalidatePath("/embedded-forms");
    revalidatePath(`/embedded-forms/${formId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Publish failed" };
  }
}

export async function setEmbeddedFormStatusAction(
  formId: string,
  status: EmbeddedFormStatus,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await requireEmbeddedManager();
    await prisma.embeddedForm.update({ where: { id: formId }, data: { status } });
    await prisma.embeddedFormAuditLog.create({
      data: {
        formId,
        userId: session.user?.id ?? null,
        action: "status_changed",
        metadata: { status },
      },
    });
    revalidatePath("/embedded-forms");
    revalidatePath(`/embedded-forms/${formId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function saveEmbeddedRegistrarFieldsAction(
  submissionId: string,
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await requireEmbeddedManager();
    const submission = await prisma.embeddedFormSubmission.findUnique({
      where: { id: submissionId },
      include: { form: true },
    });
    if (!submission) return { ok: false, error: "Submission not found." };

    const def =
      parseEmbeddedFormDefinitionJson(submission.definitionSnapshotJson) ||
      parseEmbeddedFormDefinitionJson(submission.form.publishedDefinitionJson) ||
      parseEmbeddedFormDefinitionJson(submission.form.draftDefinitionJson);
    if (!def) return { ok: false, error: "Form definition missing." };

    const parsed = parseEmbeddedRegistrarForm(def, formData);
    if (!parsed.ok) return parsed;

    const decision = String(parsed.responses.registrarAdmissionDecision ?? "").trim();
    let status: EmbeddedSubmissionStatus = submission.status;
    if (decision === "Approved") status = "APPROVED";
    else if (decision === "Rejected") status = "REJECTED";
    else if (decision === "Referred") status = "REFERRED";

    const receivedRaw = String(parsed.responses.registrarDateReceived ?? "").trim();
    const receivedAt = receivedRaw ? new Date(receivedRaw) : submission.receivedAt;

    await prisma.embeddedFormSubmission.update({
      where: { id: submissionId },
      data: {
        registrarResponsesJson: parsed.responses as Prisma.InputJsonValue,
        status,
        receivedAt: receivedAt && !Number.isNaN(receivedAt.getTime()) ? receivedAt : submission.receivedAt,
        reviewedAt: decision ? new Date() : submission.reviewedAt,
        reviewedByUserId: session.user?.id ?? null,
      },
    });

    revalidatePath(`/embedded-forms/${submission.formId}/submissions/${submissionId}`);
    revalidatePath(`/embedded-forms/${submission.formId}/submissions`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to save registrar fields" };
  }
}

export async function resendEmbeddedApplicationEmailAction(
  submissionId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireEmbeddedManager();
    const result = await sendEmbeddedApplicationReceivedEmail(submissionId);
    if (result === "sent") {
      const sub = await prisma.embeddedFormSubmission.findUnique({ where: { id: submissionId } });
      if (sub) revalidatePath(`/embedded-forms/${sub.formId}/submissions/${submissionId}`);
      return { ok: true };
    }
    if (result === "skipped_no_graph") {
      return { ok: false, error: "Email is not configured (Microsoft Graph)." };
    }
    if (result === "skipped_no_email") {
      return { ok: false, error: "Submission has no email address." };
    }
    return { ok: false, error: "Failed to send email." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

/** Used by list page to ensure HTC template exists for directory managers. */
export async function ensureEmbeddedFormsForAdmin() {
  const session = await auth();
  if (!session?.user?.role || !canManageDirectory(session.user.role)) return;
  await ensureHtcEmbeddedForm();
}

export async function createBlankEmbeddedFormAction(
  formData: FormData,
): Promise<{ ok: true; formId: string } | { ok: false; error: string }> {
  try {
    await requireEmbeddedManager();
    const title = String(formData.get("title") ?? "").trim() || "New embedded form";
    const slugBase = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60);
    const slug = `${slugBase || "form"}-${Date.now().toString(36)}`;
    const emptyDef = embeddedDefinitionToJson({
      version: 1,
      sections: [
        {
          id: "sec_main",
          title: "Application",
          order: 0,
        },
      ],
      fields: [
        {
          id: "f_name",
          sectionId: "sec_main",
          key: "fullName",
          type: "text",
          label: "Full name",
          required: true,
          order: 0,
          visibility: "applicant",
        },
        {
          id: "f_email",
          sectionId: "sec_main",
          key: "email",
          type: "email",
          label: "Email",
          required: true,
          order: 1,
          visibility: "applicant",
        },
      ],
    });
    const form = await prisma.embeddedForm.create({
      data: {
        title,
        slug,
        status: "DRAFT",
        draftDefinitionJson: emptyDef,
        applicationNumberPrefix: "APP",
      },
    });
    revalidatePath("/embedded-forms");
    return { ok: true, formId: form.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to create form" };
  }
}

