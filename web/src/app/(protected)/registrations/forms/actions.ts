"use server";

import { auth } from "@/auth";
import { ensureRegistrationFormForSeason } from "@/lib/ensure-registration-form";
import { prisma } from "@/lib/prisma";
import {
  createDefaultFormDefinition,
  definitionToJson,
  formDefinitionSchema,
  parseFormDefinitionJson,
} from "@/lib/registration-form-definition";
import { sendAllApprovedRegistrationsEmailForSubmission } from "@/lib/email/registration-emails";
import { canManageDirectory } from "@/lib/roles";
import type { RegistrationFormStatus, RegistrationStatus } from "@/generated/prisma";
import { revalidatePath } from "next/cache";

export type ActionState = { ok: boolean; message: string };

const RF_PATH = "/registrations/forms";

function revalidateSeason(seasonId: string) {
  revalidatePath(RF_PATH);
  revalidatePath(`${RF_PATH}/${seasonId}`);
  revalidatePath(`${RF_PATH}/${seasonId}/edit`);
  revalidatePath(`${RF_PATH}/${seasonId}/settings`);
  revalidatePath(`${RF_PATH}/${seasonId}/preview`);
  revalidatePath(`${RF_PATH}/${seasonId}/submissions`);
  revalidatePath("/register");
  revalidatePath("/seasons");
}

async function auditForm(
  formId: string,
  userId: string | undefined,
  action: string,
  metadata?: Record<string, unknown>,
) {
  await prisma.registrationFormAuditLog.create({
    data: {
      formId,
      userId: userId ?? null,
      action,
      metadata: metadata ? (metadata as object) : undefined,
    },
  });
}

export async function saveRegistrationFormDraft(seasonId: string, definitionJson: string): Promise<ActionState> {
  const session = await auth();
  if (!session?.user?.role || !canManageDirectory(session.user.role)) {
    return { ok: false, message: "You do not have permission to edit forms." };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(definitionJson) as unknown;
  } catch {
    return { ok: false, message: "Invalid JSON." };
  }

  const def = formDefinitionSchema.safeParse(parsed);
  if (!def.success) {
    return { ok: false, message: "Form definition failed validation. Check fields and sections." };
  }

  const season = await prisma.vbsSeason.findUnique({ where: { id: seasonId } });
  if (!season) return { ok: false, message: "Season not found." };

  const form =
    (await prisma.registrationForm.findUnique({ where: { seasonId } })) ??
    (await ensureRegistrationFormForSeason(season.id, season.name));

  const json = definitionToJson(def.data);
  await prisma.registrationForm.update({
    where: { id: form.id },
    data: {
      draftDefinitionJson: json,
      updatedByUserId: session.user.id ?? undefined,
    },
  });

  await auditForm(form.id, session.user.id, "DRAFT_SAVED", { version: def.data.version });

  revalidateSeason(seasonId);
  return { ok: true, message: "Draft saved." };
}

export async function publishRegistrationForm(seasonId: string): Promise<ActionState> {
  const session = await auth();
  if (!session?.user?.role || !canManageDirectory(session.user.role)) {
    return { ok: false, message: "You do not have permission to publish." };
  }

  const form = await prisma.registrationForm.findUnique({ where: { seasonId } });
  if (!form) return { ok: false, message: "No registration form for this season yet." };

  const draft = parseFormDefinitionJson(form.draftDefinitionJson ?? form.publishedDefinitionJson);
  if (!draft) {
    return { ok: false, message: "Draft definition is empty or invalid. Fix it in the editor first." };
  }

  const json = definitionToJson(draft);
  const nextVersion = (form.publishedVersion ?? 0) + 1;

  await prisma.registrationForm.update({
    where: { id: form.id },
    data: {
      publishedDefinitionJson: json,
      draftDefinitionJson: json,
      publishedVersion: nextVersion,
      publishedAt: new Date(),
      status: "PUBLISHED",
      updatedByUserId: session.user.id ?? undefined,
    },
  });

  await auditForm(form.id, session.user.id, "PUBLISHED", { publishedVersion: nextVersion });

  revalidateSeason(seasonId);
  return { ok: true, message: `Published as version ${nextVersion}.` };
}

export async function setRegistrationFormStatus(
  seasonId: string,
  status: RegistrationFormStatus,
): Promise<ActionState> {
  const session = await auth();
  if (!session?.user?.role || !canManageDirectory(session.user.role)) {
    return { ok: false, message: "Unauthorized." };
  }

  const form = await prisma.registrationForm.findUnique({ where: { seasonId } });
  if (!form) return { ok: false, message: "Form not found." };

  await prisma.registrationForm.update({
    where: { id: form.id },
    data: { status, updatedByUserId: session.user.id ?? undefined },
  });

  await auditForm(form.id, session.user.id, "STATUS_CHANGED", { status });

  revalidateSeason(seasonId);
  return { ok: true, message: `Form status set to ${status}.` };
}

export async function updateRegistrationFormSettings(
  seasonId: string,
  data: {
    title: string;
    welcomeMessage: string | null;
    instructions: string | null;
    confirmationMessage: string | null;
    registrationOpensAt: Date | null;
    registrationClosesAt: Date | null;
    maxTotalRegistrations: number | null;
    waitlistEnabled: boolean;
    publicRegistrationOpen: boolean;
    minimumParticipantAgeYears: number | null;
  },
): Promise<ActionState> {
  const session = await auth();
  if (!session?.user?.role || !canManageDirectory(session.user.role)) {
    return { ok: false, message: "Unauthorized." };
  }

  const season = await prisma.vbsSeason.findUnique({ where: { id: seasonId } });
  if (!season) return { ok: false, message: "Season not found." };

  const form =
    (await prisma.registrationForm.findUnique({ where: { seasonId } })) ??
    (await ensureRegistrationFormForSeason(season.id, season.name));

  const title = data.title.trim();
  if (!title) return { ok: false, message: "Title is required." };

  const minAge =
    data.minimumParticipantAgeYears != null && data.minimumParticipantAgeYears >= 1
      ? Math.min(25, Math.floor(data.minimumParticipantAgeYears))
      : null;

  await prisma.$transaction([
    prisma.vbsSeason.update({
      where: { id: seasonId },
      data: { publicRegistrationOpen: data.publicRegistrationOpen },
    }),
    prisma.registrationForm.update({
      where: { id: form.id },
      data: {
        title,
        welcomeMessage: data.welcomeMessage,
        instructions: data.instructions,
        confirmationMessage: data.confirmationMessage,
        registrationOpensAt: data.registrationOpensAt,
        registrationClosesAt: data.registrationClosesAt,
        maxTotalRegistrations: data.maxTotalRegistrations,
        waitlistEnabled: data.waitlistEnabled,
        minimumParticipantAgeYears: minAge,
        updatedByUserId: session.user.id ?? undefined,
      },
    }),
  ]);

  await auditForm(form.id, session.user.id, "SETTINGS_UPDATED");

  revalidateSeason(seasonId);
  return { ok: true, message: "All settings saved." };
}

export async function cloneRegistrationFormFromSeason(
  targetSeasonId: string,
  sourceSeasonId: string,
): Promise<ActionState> {
  const session = await auth();
  if (!session?.user?.role || !canManageDirectory(session.user.role)) {
    return { ok: false, message: "Unauthorized." };
  }

  if (targetSeasonId === sourceSeasonId) {
    return { ok: false, message: "Choose a different season to clone from." };
  }

  const [target, source] = await Promise.all([
    prisma.vbsSeason.findUnique({ where: { id: targetSeasonId } }),
    prisma.vbsSeason.findUnique({ where: { id: sourceSeasonId }, include: { registrationForm: true } }),
  ]);

  if (!target || !source) return { ok: false, message: "Season not found." };

  const srcForm = source.registrationForm ?? (await ensureRegistrationFormForSeason(source.id, source.name));
  const draft = parseFormDefinitionJson(srcForm.draftDefinitionJson ?? srcForm.publishedDefinitionJson);
  const def = draft ?? createDefaultFormDefinition();
  const json = definitionToJson(def);

  const targetForm =
    (await prisma.registrationForm.findUnique({ where: { seasonId: targetSeasonId } })) ??
    (await ensureRegistrationFormForSeason(target.id, target.name));

  await prisma.registrationForm.update({
    where: { id: targetForm.id },
    data: {
      title: `${target.name} — VBS registration`,
      welcomeMessage: srcForm.welcomeMessage,
      instructions: srcForm.instructions,
      confirmationMessage: srcForm.confirmationMessage,
      draftDefinitionJson: json,
      maxTotalRegistrations: srcForm.maxTotalRegistrations,
      waitlistEnabled: srcForm.waitlistEnabled,
      registrationOpensAt: srcForm.registrationOpensAt,
      registrationClosesAt: srcForm.registrationClosesAt,
      minimumParticipantAgeYears: srcForm.minimumParticipantAgeYears,
      updatedByUserId: session.user.id ?? undefined,
    },
  });

  await auditForm(targetForm.id, session.user.id, "CLONED_FROM", { sourceSeasonId });

  revalidateSeason(targetSeasonId);
  return { ok: true, message: `Cloned layout and settings from ${source.name}. Review and publish when ready.` };
}

export async function resetDraftFromPublished(seasonId: string): Promise<ActionState> {
  const session = await auth();
  if (!session?.user?.role || !canManageDirectory(session.user.role)) {
    return { ok: false, message: "Unauthorized." };
  }

  const form = await prisma.registrationForm.findUnique({ where: { seasonId } });
  if (!form?.publishedDefinitionJson) {
    return { ok: false, message: "Nothing published to reset from." };
  }

  await prisma.registrationForm.update({
    where: { id: form.id },
    data: {
      draftDefinitionJson: form.publishedDefinitionJson,
      updatedByUserId: session.user.id ?? undefined,
    },
  });

  await auditForm(form.id, session.user.id, "DRAFT_RESET_FROM_PUBLISHED");

  revalidateSeason(seasonId);
  return { ok: true, message: "Draft replaced with the current published definition." };
}

export async function updateSubmissionRegistrations(
  submissionId: string,
  updates: Array<{ registrationId: string; status?: string; notes?: string | null }>,
): Promise<ActionState> {
  const session = await auth();
  if (!session?.user?.role || !canManageDirectory(session.user.role)) {
    return { ok: false, message: "Unauthorized." };
  }

  const submission = await prisma.formSubmission.findUnique({
    where: { id: submissionId },
    include: { form: true },
  });
  if (!submission) return { ok: false, message: "Submission not found." };

  const allowedStatus = new Set<string>([
    "PENDING",
    "CONFIRMED",
    "CANCELLED",
    "WAITLIST",
    "DRAFT",
    "CHECKED_OUT",
  ]);

  for (const u of updates) {
    const reg = await prisma.registration.findFirst({
      where: { id: u.registrationId, formSubmissionId: submissionId },
    });
    if (!reg) continue;
    const st =
      u.status && allowedStatus.has(u.status) ? (u.status as RegistrationStatus) : undefined;
    await prisma.registration.update({
      where: { id: u.registrationId },
      data: {
        ...(st ? { status: st } : {}),
        ...(u.notes !== undefined ? { notes: u.notes } : {}),
      },
    });
  }

  if (submission.formId) {
    await auditForm(submission.formId, session.user.id, "SUBMISSION_REGISTRATIONS_UPDATED", {
      submissionId,
    });
  }

  revalidatePath(`${RF_PATH}/${submission.seasonId}/submissions`);
  revalidatePath(`${RF_PATH}/${submission.seasonId}/submissions/${submissionId}`);
  revalidatePath("/registrations");
  for (const u of updates) {
    if (u.registrationId) revalidatePath(`/registrations/${u.registrationId}`);
  }
  return { ok: true, message: "Registration rows updated." };
}

export async function updateSubmissionGuardianAndResponses(
  submissionId: string,
  data: {
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    guardianResponsesJson: string | null;
  },
): Promise<ActionState> {
  const session = await auth();
  if (!session?.user?.role || !canManageDirectory(session.user.role)) {
    return { ok: false, message: "Unauthorized." };
  }

  const submission = await prisma.formSubmission.findUnique({
    where: { id: submissionId },
    include: { form: true },
  });
  if (!submission) return { ok: false, message: "Submission not found." };

  const fn = data.firstName.trim();
  const ln = data.lastName.trim();
  if (!fn || !ln) return { ok: false, message: "Guardian first and last name are required." };

  let responses: object = {};
  if (data.guardianResponsesJson?.trim()) {
    try {
      responses = JSON.parse(data.guardianResponsesJson) as object;
    } catch {
      return { ok: false, message: "Guardian extra responses must be valid JSON." };
    }
  }

  await prisma.$transaction([
    prisma.guardian.update({
      where: { id: submission.guardianId },
      data: {
        firstName: fn,
        lastName: ln,
        email: data.email?.trim() || null,
        phone: data.phone?.trim() || null,
      },
    }),
    prisma.formSubmission.update({
      where: { id: submissionId },
      data: { guardianResponses: responses },
    }),
  ]);

  if (submission.formId) {
    await auditForm(submission.formId, session.user.id, "SUBMISSION_GUARDIAN_UPDATED", { submissionId });
  }

  revalidatePath(`${RF_PATH}/${submission.seasonId}/submissions`);
  revalidatePath(`${RF_PATH}/${submission.seasonId}/submissions/${submissionId}`);
  return { ok: true, message: "Guardian and response data saved." };
}

export async function bulkMoveSubmissionToWaitlist(submissionId: string): Promise<ActionState> {
  const session = await auth();
  if (!session?.user?.role || !canManageDirectory(session.user.role)) {
    return { ok: false, message: "Unauthorized." };
  }

  const submission = await prisma.formSubmission.findUnique({
    where: { id: submissionId },
    include: { form: true },
  });
  if (!submission) return { ok: false, message: "Submission not found." };

  await prisma.registration.updateMany({
    where: { formSubmissionId: submissionId },
    data: { status: "WAITLIST" },
  });

  if (submission.formId) {
    await auditForm(submission.formId, session.user.id, "SUBMISSION_WAITLIST", { submissionId });
  }

  revalidatePath(`${RF_PATH}/${submission.seasonId}/submissions`);
  revalidatePath(`${RF_PATH}/${submission.seasonId}/submissions/${submissionId}`);
  return { ok: true, message: "All children on this submission moved to waitlist." };
}

export async function bulkCancelSubmission(submissionId: string): Promise<ActionState> {
  const session = await auth();
  if (!session?.user?.role || !canManageDirectory(session.user.role)) {
    return { ok: false, message: "Unauthorized." };
  }

  const submission = await prisma.formSubmission.findUnique({
    where: { id: submissionId },
    include: { form: true },
  });
  if (!submission) return { ok: false, message: "Submission not found." };

  await prisma.registration.updateMany({
    where: { formSubmissionId: submissionId },
    data: { status: "CANCELLED" },
  });

  if (submission.formId) {
    await auditForm(submission.formId, session.user.id, "SUBMISSION_CANCELLED", { submissionId });
  }

  revalidatePath(`${RF_PATH}/${submission.seasonId}/submissions`);
  revalidatePath(`${RF_PATH}/${submission.seasonId}/submissions/${submissionId}`);
  return { ok: true, message: "All children on this submission cancelled." };
}

export async function resendRegistrationConfirmation(submissionId: string): Promise<ActionState> {
  const session = await auth();
  if (!session?.user?.role || !canManageDirectory(session.user.role)) {
    return { ok: false, message: "Unauthorized." };
  }

  const submission = await prisma.formSubmission.findUnique({
    where: { id: submissionId },
    include: { registrations: { where: { status: "CONFIRMED" } } },
  });
  if (!submission) return { ok: false, message: "Submission not found." };
  if (submission.registrations.length === 0) {
    return {
      ok: false,
      message: "No confirmed registrations on this submission. Confirm at least one child first.",
    };
  }

  const r = await sendAllApprovedRegistrationsEmailForSubmission(submissionId);
  if (r === "sent") {
    return { ok: true, message: "Confirmation email with QR code(s) sent to the guardian." };
  }
  if (r === "skipped_no_graph") {
    return { ok: false, message: "Microsoft Graph email is not configured on the server." };
  }
  if (r === "skipped_no_email") {
    return { ok: false, message: "Guardian has no email address on file." };
  }
  return { ok: false, message: "Email failed to send. Check server logs." };
}
