import type { RegistrationStatus } from "@/generated/prisma";
import {
  sendAllApprovedRegistrationsEmailForSubmission,
  sendRegistrationApprovedEmail,
} from "@/lib/email/registration-emails";
import { prisma } from "@/lib/prisma";
import { registrationPaymentIsComplete } from "@/lib/registration-list-payment";
import { makeCheckInToken, makeUniqueRegistrationNumber } from "@/lib/registration-identity";

const AUTO_APPROVE_STATUSES: RegistrationStatus[] = ["PENDING", "WAITLIST"];

type RegForAutoApprove = {
  id: string;
  status: RegistrationStatus;
  seasonId: string;
  classroomId: string | null;
  formSubmissionId: string | null;
  expectsPayment: boolean;
  paymentReceivedAt: Date | null;
  formSubmission: {
    stripePaymentStatus: string | null;
    stripeCheckoutSessionId: string | null;
  } | null;
};

function paymentConditionMet(reg: RegForAutoApprove): boolean {
  if (reg.expectsPayment) {
    return registrationPaymentIsComplete(reg);
  }
  return true;
}

async function loadRegForAutoApprove(registrationId: string): Promise<RegForAutoApprove | null> {
  return prisma.registration.findUnique({
    where: { id: registrationId },
    select: {
      id: true,
      status: true,
      seasonId: true,
      classroomId: true,
      formSubmissionId: true,
      expectsPayment: true,
      paymentReceivedAt: true,
      formSubmission: {
        select: {
          stripePaymentStatus: true,
          stripeCheckoutSessionId: true,
        },
      },
    },
  });
}

async function isAutoApproveEnabledForSeason(seasonId: string): Promise<boolean> {
  const form = await prisma.registrationForm.findUnique({
    where: { seasonId },
    select: { autoApproveWhenClassAssignedAndPaid: true },
  });
  return form?.autoApproveWhenClassAssignedAndPaid === true;
}

function isEligibleForAutoApprove(
  reg: RegForAutoApprove,
  autoApproveEnabled: boolean,
): boolean {
  if (!autoApproveEnabled) return false;
  if (!reg.classroomId) return false;
  if (!AUTO_APPROVE_STATUSES.includes(reg.status)) return false;
  return paymentConditionMet(reg);
}

async function confirmRegistrationRecord(registrationId: string): Promise<boolean> {
  let newlyConfirmed = false;

  for (let i = 0; i < 8; i++) {
    try {
      await prisma.$transaction(async (tx) => {
        const current = await tx.registration.findUnique({
          where: { id: registrationId },
          include: { season: { select: { year: true } } },
        });
        if (!current) return;
        if (current.status === "CANCELLED" || current.status === "CHECKED_OUT") return;
        if (current.status === "CONFIRMED" && current.registrationNumber && current.checkInToken) {
          return;
        }

        const registrationNumber =
          current.registrationNumber ??
          (await makeUniqueRegistrationNumber(
            { seasonId: current.seasonId, seasonYear: current.season.year },
            tx,
          ));
        const checkInToken = current.checkInToken ?? makeCheckInToken();

        await tx.registration.update({
          where: { id: registrationId },
          data: {
            status: "CONFIRMED",
            registrationNumber,
            checkInToken,
          },
        });
        newlyConfirmed = current.status !== "CONFIRMED";
      });
      break;
    } catch (e: unknown) {
      const code =
        e && typeof e === "object" && "code" in e ? String((e as { code: unknown }).code) : "";
      if (code === "P2002" && i < 7) continue;
      console.error("[auto-approve] confirmRegistrationRecord", e);
      return false;
    }
  }

  return newlyConfirmed;
}

async function sendAutoApproveConfirmationEmail(
  formSubmissionId: string | null,
  registrationId: string,
): Promise<void> {
  if (formSubmissionId) {
    await sendAllApprovedRegistrationsEmailForSubmission(formSubmissionId);
    return;
  }
  await sendRegistrationApprovedEmail(registrationId, { recordSentTimestamp: true });
}

/** Confirm one registration when class + payment conditions are met. Sends email for that row only. */
export async function tryAutoApproveRegistration(registrationId: string): Promise<void> {
  const reg = await loadRegForAutoApprove(registrationId);
  if (!reg) return;

  const enabled = await isAutoApproveEnabledForSeason(reg.seasonId);
  if (!isEligibleForAutoApprove(reg, enabled)) return;

  const newlyConfirmed = await confirmRegistrationRecord(registrationId);
  if (!newlyConfirmed) return;

  try {
    await sendAutoApproveConfirmationEmail(reg.formSubmissionId, registrationId);
  } catch (e) {
    console.error("[auto-approve] confirmation email", e);
  }
}

/** Confirm every eligible registration on a submission, then send one family email. */
export async function tryAutoApproveRegistrationsForSubmission(submissionId: string): Promise<void> {
  const submission = await prisma.formSubmission.findUnique({
    where: { id: submissionId },
    select: { seasonId: true },
  });
  if (!submission) return;

  const enabled = await isAutoApproveEnabledForSeason(submission.seasonId);
  if (!enabled) return;

  const regs = await prisma.registration.findMany({
    where: {
      formSubmissionId: submissionId,
      status: { in: AUTO_APPROVE_STATUSES },
    },
    select: {
      id: true,
      status: true,
      seasonId: true,
      classroomId: true,
      formSubmissionId: true,
      expectsPayment: true,
      paymentReceivedAt: true,
      formSubmission: {
        select: {
          stripePaymentStatus: true,
          stripeCheckoutSessionId: true,
        },
      },
    },
  });

  let anyConfirmed = false;
  for (const reg of regs) {
    if (!isEligibleForAutoApprove(reg, true)) continue;
    const confirmed = await confirmRegistrationRecord(reg.id);
    if (confirmed) anyConfirmed = true;
  }

  if (!anyConfirmed) return;

  try {
    await sendAllApprovedRegistrationsEmailForSubmission(submissionId);
  } catch (e) {
    console.error("[auto-approve] submission confirmation email", e);
  }
}

/** Prefer submission-level batch when linked; otherwise single registration. */
export async function tryAutoApproveAfterRegistrationUpdate(params: {
  registrationId: string;
  formSubmissionId?: string | null;
}): Promise<void> {
  if (params.formSubmissionId) {
    await tryAutoApproveRegistrationsForSubmission(params.formSubmissionId);
    return;
  }
  await tryAutoApproveRegistration(params.registrationId);
}
