"use server";

import { auth } from "@/auth";
import {
  formatCancellationEmailHint,
  sendAllApprovedRegistrationsEmailForSubmission,
  sendCheckoutReminderEmail,
  sendPaymentReminderEmail,
  sendRegistrationApprovedEmail,
  sendRegistrationCancelledEmail,
} from "@/lib/email/registration-emails";
import { isCheckoutPendingRegistration } from "@/lib/registration-list-payment";
import { tryAutoAssignRegistration } from "@/lib/class-assignment";
import { makeCheckInToken, makeUniqueRegistrationNumber } from "@/lib/registration-identity";
import { prisma } from "@/lib/prisma";
import { canManageDirectory } from "@/lib/roles";
import { sendCustomRegistrationSms, sendRegistrationConfirmationSms } from "@/lib/sms/registration-sms";
import { revalidatePath } from "next/cache";

export type RegActionState = { ok: boolean; message: string };

function revalidateRegistrationPaths(seasonId?: string | null) {
  revalidatePath("/registrations");
  if (seasonId) {
    revalidatePath(`/registrations/forms/${seasonId}/submissions`);
  }
}

export async function approveRegistration(registrationId: string): Promise<RegActionState> {
  const session = await auth();
  if (!session?.user?.role || !canManageDirectory(session.user.role)) {
    return { ok: false, message: "You do not have permission." };
  }

  const reg = await prisma.registration.findUnique({
    where: { id: registrationId },
    select: { id: true, status: true, seasonId: true, formSubmissionId: true },
  });
  if (!reg) return { ok: false, message: "Registration not found." };
  if (reg.status === "CANCELLED" || reg.status === "CHECKED_OUT") {
    return { ok: false, message: "This registration cannot be approved in its current state." };
  }
  if (reg.status === "CONFIRMED") {
    return { ok: false, message: "Already confirmed. Use resend confirmation if needed." };
  }

  for (let i = 0; i < 8; i++) {
    try {
      await prisma.$transaction(async (tx) => {
        const current = await tx.registration.findUnique({
          where: { id: registrationId },
          include: { season: { select: { year: true } } },
        });
        if (!current) throw new Error("Registration not found.");
        if (current.status === "CANCELLED" || current.status === "CHECKED_OUT") {
          throw new Error("This registration cannot be approved in its current state.");
        }
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
      });
      break;
    } catch (e: unknown) {
      const code = e && typeof e === "object" && "code" in e ? String((e as { code: unknown }).code) : "";
      if (code === "P2002" && i < 7) continue;
      if (e instanceof Error) return { ok: false, message: e.message };
      return { ok: false, message: "Could not approve registration right now. Please try again." };
    }
  }

  await tryAutoAssignRegistration(registrationId);

  const emailResult = reg.formSubmissionId
    ? await sendAllApprovedRegistrationsEmailForSubmission(reg.formSubmissionId)
    : await sendRegistrationApprovedEmail(registrationId, { recordSentTimestamp: true });
  const emailHint =
    emailResult === "sent"
      ? " Confirmation email sent."
      : emailResult === "skipped_no_graph"
        ? " (Email not configured — send details manually.)"
        : emailResult === "skipped_ineligible"
          ? " (Registration must be confirmed with an assigned ticket before emailing.)"
        : emailResult === "skipped_no_email"
          ? " (No guardian email — cannot send confirmation.)"
          : " (Confirmation email failed — check server logs.)";

  revalidateRegistrationPaths(reg.seasonId);
  revalidatePath(`/registrations/${registrationId}`);
  return { ok: true, message: `Registration approved.${emailHint}` };
}

export async function declineRegistration(registrationId: string): Promise<RegActionState> {
  const session = await auth();
  if (!session?.user?.role || !canManageDirectory(session.user.role)) {
    return { ok: false, message: "You do not have permission." };
  }

  const reg = await prisma.registration.findUnique({
    where: { id: registrationId },
    select: { id: true, seasonId: true, status: true },
  });
  if (!reg) return { ok: false, message: "Registration not found." };
  if (reg.status === "CANCELLED") {
    return { ok: false, message: "This registration is already cancelled." };
  }

  await prisma.registration.update({
    where: { id: registrationId },
    data: { status: "CANCELLED" },
  });

  const emailResult = await sendRegistrationCancelledEmail(registrationId);

  revalidateRegistrationPaths(reg.seasonId);
  revalidatePath(`/registrations/${registrationId}`);
  return {
    ok: true,
    message: `Registration declined (cancelled).${formatCancellationEmailHint(emailResult)}`,
  };
}

export async function deleteRegistrationRecord(registrationId: string): Promise<RegActionState> {
  const session = await auth();
  if (!session?.user?.role || !canManageDirectory(session.user.role)) {
    return { ok: false, message: "You do not have permission." };
  }

  const reg = await prisma.registration.findUnique({
    where: { id: registrationId },
    select: { id: true, childId: true, seasonId: true },
  });
  if (!reg) return { ok: false, message: "Registration not found." };

  await prisma.registration.delete({ where: { id: registrationId } });

  const remaining = await prisma.registration.count({ where: { childId: reg.childId } });
  if (remaining === 0) {
    await prisma.child.delete({ where: { id: reg.childId } }).catch(() => {});
  }

  revalidateRegistrationPaths(reg.seasonId);
  return { ok: true, message: "Registration removed." };
}

export async function resendRegistrationConfirmationEmailAction(registrationId: string): Promise<RegActionState> {
  const session = await auth();
  if (!session?.user?.role || !canManageDirectory(session.user.role)) {
    return { ok: false, message: "You do not have permission." };
  }

  const reg = await prisma.registration.findUnique({
    where: { id: registrationId },
    select: { status: true },
  });
  if (!reg) return { ok: false, message: "Registration not found." };
  if (reg.status !== "CONFIRMED") {
    return { ok: false, message: "Only confirmed registrations can receive the confirmation email." };
  }

  const emailResult = await sendRegistrationApprovedEmail(registrationId, { recordSentTimestamp: true });
  if (emailResult === "sent") return { ok: true, message: "Confirmation email sent." };
  if (emailResult === "skipped_no_graph") {
    return { ok: false, message: "Microsoft Graph email is not configured." };
  }
  if (emailResult === "skipped_ineligible") {
    return { ok: false, message: "Registration needs approval and ticket assignment first." };
  }
  if (emailResult === "skipped_no_email") {
    return { ok: false, message: "Guardian has no email on file." };
  }
  return { ok: false, message: "Email failed to send. Check server logs." };
}

export async function sendCheckoutReminderEmailAction(registrationId: string): Promise<RegActionState> {
  const session = await auth();
  if (!session?.user?.role || !canManageDirectory(session.user.role)) {
    return { ok: false, message: "You do not have permission." };
  }

  const reg = await prisma.registration.findUnique({
    where: { id: registrationId },
    select: {
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
  if (!reg) return { ok: false, message: "Registration not found." };
  if (!reg.formSubmissionId) {
    return { ok: false, message: "This registration is not linked to an online form submission." };
  }
  if (
    !isCheckoutPendingRegistration({
      expectsPayment: reg.expectsPayment,
      paymentReceivedAt: reg.paymentReceivedAt,
      formSubmission: reg.formSubmission,
    })
  ) {
    return {
      ok: false,
      message: "Checkout reminder only applies when Stripe checkout is still pending for this family.",
    };
  }

  const r = await sendCheckoutReminderEmail(reg.formSubmissionId);
  if (r === "sent") return { ok: true, message: "Checkout reminder sent." };
  if (r === "skipped_no_graph") {
    return { ok: false, message: "Microsoft Graph email is not configured." };
  }
  if (r === "skipped_no_email") {
    return { ok: false, message: "Guardian has no email on file." };
  }
  if (r === "skipped_ineligible") {
    return { ok: false, message: "This family is no longer in checkout-pending status." };
  }
  return { ok: false, message: "Could not send checkout reminder." };
}

export async function sendCheckoutReminderForSubmissionAction(
  submissionId: string,
): Promise<RegActionState> {
  const session = await auth();
  if (!session?.user?.role || !canManageDirectory(session.user.role)) {
    return { ok: false, message: "You do not have permission." };
  }

  const submission = await prisma.formSubmission.findUnique({
    where: { id: submissionId },
    include: {
      registrations: {
        where: { status: { not: "CANCELLED" } },
        take: 1,
        select: {
          expectsPayment: true,
          paymentReceivedAt: true,
        },
      },
    },
  });
  if (!submission) return { ok: false, message: "Submission not found." };
  const sample = submission.registrations[0];
  if (!sample) {
    return { ok: false, message: "No active registrations on this submission." };
  }
  if (
    !isCheckoutPendingRegistration({
      expectsPayment: sample.expectsPayment,
      paymentReceivedAt: sample.paymentReceivedAt,
      formSubmission: {
        stripePaymentStatus: submission.stripePaymentStatus,
        stripeCheckoutSessionId: submission.stripeCheckoutSessionId,
      },
    })
  ) {
    return { ok: false, message: "This submission is not in checkout-pending status." };
  }

  const r = await sendCheckoutReminderEmail(submissionId);
  if (r === "sent") {
    return { ok: true, message: "Checkout reminder sent to the guardian." };
  }
  if (r === "skipped_no_graph") {
    return { ok: false, message: "Microsoft Graph email is not configured." };
  }
  if (r === "skipped_no_email") {
    return { ok: false, message: "Guardian has no email on file." };
  }
  return { ok: false, message: "Could not send checkout reminder." };
}

export async function bulkSendCheckoutRemindersAction(
  registrationIds: string[],
): Promise<RegActionState> {
  const session = await auth();
  if (!session?.user?.role || !canManageDirectory(session.user.role)) {
    return { ok: false, message: "You do not have permission." };
  }

  const uniqueIds = [...new Set(registrationIds.filter(Boolean))];
  if (uniqueIds.length === 0) {
    return { ok: false, message: "Select at least one registration." };
  }

  const regs = await prisma.registration.findMany({
    where: { id: { in: uniqueIds } },
    select: {
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

  const submissionIds = new Set<string>();
  for (const reg of regs) {
    if (!reg.formSubmissionId) continue;
    if (
      !isCheckoutPendingRegistration({
        expectsPayment: reg.expectsPayment,
        paymentReceivedAt: reg.paymentReceivedAt,
        formSubmission: reg.formSubmission,
      })
    ) {
      continue;
    }
    submissionIds.add(reg.formSubmissionId);
  }

  if (submissionIds.size === 0) {
    return {
      ok: false,
      message: "None of the selected rows are in checkout-pending status with an email on file.",
    };
  }

  let sent = 0;
  let failed = 0;
  for (const submissionId of submissionIds) {
    const r = await sendCheckoutReminderEmail(submissionId);
    if (r === "sent") sent += 1;
    else failed += 1;
  }

  revalidatePath("/registrations");
  if (sent === 0) {
    return { ok: false, message: "Could not send any checkout reminders. Check email config and status." };
  }
  const failNote = failed > 0 ? ` ${failed} could not be sent.` : "";
  return {
    ok: true,
    message: `Checkout reminder sent for ${sent} famil${sent === 1 ? "y" : "ies"}.${failNote}`,
  };
}

export async function resendPaymentReminderEmailAction(registrationId: string): Promise<RegActionState> {
  const session = await auth();
  if (!session?.user?.role || !canManageDirectory(session.user.role)) {
    return { ok: false, message: "You do not have permission." };
  }

  const reg = await prisma.registration.findUnique({
    where: { id: registrationId },
    select: { expectsPayment: true, paymentReceivedAt: true },
  });
  if (!reg) return { ok: false, message: "Registration not found." };
  if (!reg.expectsPayment) {
    return { ok: false, message: "Turn on “expects payment” for this registration first." };
  }
  if (reg.paymentReceivedAt) {
    return { ok: false, message: "Payment is already marked received." };
  }

  const r = await sendPaymentReminderEmail(registrationId);
  if (r === "sent") return { ok: true, message: "Payment reminder sent." };
  if (r === "skipped_no_graph") return { ok: false, message: "Microsoft Graph email is not configured." };
  if (r === "skipped_no_email") return { ok: false, message: "Guardian has no email on file." };
  return { ok: false, message: "Could not send payment reminder." };
}

export async function setRegistrationExpectsPayment(
  registrationId: string,
  expectsPayment: boolean,
): Promise<RegActionState> {
  const session = await auth();
  if (!session?.user?.role || !canManageDirectory(session.user.role)) {
    return { ok: false, message: "You do not have permission." };
  }

  await prisma.registration.update({
    where: { id: registrationId },
    data: { expectsPayment },
  });

  revalidatePath(`/registrations/${registrationId}`);
  return { ok: true, message: expectsPayment ? "Marked as expecting payment." : "Payment expectation cleared." };
}

export async function markRegistrationPaymentReceived(registrationId: string): Promise<RegActionState> {
  const session = await auth();
  if (!session?.user?.role || !canManageDirectory(session.user.role)) {
    return { ok: false, message: "You do not have permission." };
  }

  await prisma.registration.update({
    where: { id: registrationId },
    data: { paymentReceivedAt: new Date() },
  });

  revalidatePath(`/registrations/${registrationId}`);
  return { ok: true, message: "Payment marked as received." };
}

export async function sendRegistrationConfirmationSmsAction(
  registrationId: string,
): Promise<RegActionState> {
  const session = await auth();
  if (!session?.user?.role || !canManageDirectory(session.user.role)) {
    return { ok: false, message: "You do not have permission." };
  }

  const r = await sendRegistrationConfirmationSms(registrationId);
  if (r.status === "sent") {
    const via =
      r.sentViaTwilioFallback
        ? " Sent via Twilio after Sent.dm returned an error (Twilio is acting as backup)."
        : r.provider === "twilio"
          ? " Sent via Twilio."
          : "";
    return { ok: true, message: `Confirmation SMS sent.${via}` };
  }
  if (r.status === "skipped_no_sms") {
    return {
      ok: false,
      message:
        "SMS is not configured. Set Sent.dm (SENT_DM_API_KEY + SENT_DM_SMS_TEMPLATE_ID) or Twilio (TWILIO_* + TWILIO_FROM_PHONE). See .env.example.",
    };
  }
  if (r.status === "skipped_no_phone") {
    return { ok: false, message: "Guardian phone is missing or invalid for SMS." };
  }
  if (r.status === "skipped_ineligible") {
    return { ok: false, message: "Registration must be confirmed with ticket + registration number first." };
  }
  return {
    ok: false,
    message: r.status === "failed" ? `SMS failed: ${r.detail}` : "SMS could not be sent.",
  };
}

export async function sendCustomRegistrationSmsAction(
  registrationId: string,
  message: string,
): Promise<RegActionState> {
  const session = await auth();
  if (!session?.user?.role || !canManageDirectory(session.user.role)) {
    return { ok: false, message: "You do not have permission." };
  }
  if (!message.trim()) return { ok: false, message: "Message is empty." };

  const r = await sendCustomRegistrationSms(registrationId, message);
  if (r.status === "sent") {
    const via =
      r.sentViaTwilioFallback
        ? " Sent via Twilio after Sent.dm returned an error (Twilio is acting as backup)."
        : r.provider === "twilio"
          ? " Sent via Twilio."
          : "";
    return { ok: true, message: `SMS sent.${via}` };
  }
  if (r.status === "skipped_no_sms") {
    return {
      ok: false,
      message:
        "SMS is not configured. Set Sent.dm (SENT_DM_API_KEY + SENT_DM_SMS_TEMPLATE_ID) or Twilio (TWILIO_* + TWILIO_FROM_PHONE). See .env.example.",
    };
  }
  if (r.status === "skipped_no_phone") {
    return { ok: false, message: "Guardian phone is missing or invalid for SMS." };
  }
  if (r.status === "skipped_ineligible") {
    return { ok: false, message: "Message is empty." };
  }
  return {
    ok: false,
    message: r.status === "failed" ? `SMS failed: ${r.detail}` : "SMS could not be sent.",
  };
}
