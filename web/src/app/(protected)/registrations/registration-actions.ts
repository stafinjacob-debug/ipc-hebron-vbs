"use server";

import { auth } from "@/auth";
import {
  formatCancellationEmailHint,
  sendAllApprovedRegistrationsEmailForSubmission,
  sendCheckoutReminderEmail,
  sendPaymentReminderEmail,
  sendRegistrationApprovedEmail,
  sendRegistrationCancelledEmail,
  sendRegistrationsRemovedEmail,
  type EmailSendResult,
} from "@/lib/email/registration-emails";
import {
  isCheckoutPendingRegistration,
  registrationListShowsPaid,
  registrationPaymentIsComplete,
} from "@/lib/registration-list-payment";
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

async function removeRegistrationRows(registrationIds: string[]): Promise<void> {
  for (const registrationId of registrationIds) {
    const reg = await prisma.registration.findUnique({
      where: { id: registrationId },
      select: { id: true, childId: true },
    });
    if (!reg) continue;
    await prisma.registration.delete({ where: { id: registrationId } });
    const remaining = await prisma.registration.count({ where: { childId: reg.childId } });
    if (remaining === 0) {
      await prisma.child.delete({ where: { id: reg.childId } }).catch(() => {});
    }
  }
}

export async function deleteRegistrationRecord(registrationId: string): Promise<RegActionState> {
  const bulk = await bulkDeleteRegistrations([registrationId]);
  return bulk.results[0] ?? { ok: bulk.ok, message: bulk.message };
}

/** Permanently delete registrations and email guardians (one email per family per season). */
export async function bulkDeleteRegistrations(registrationIds: string[]): Promise<{
  ok: boolean;
  message: string;
  results: RegActionState[];
}> {
  const session = await auth();
  if (!session?.user?.role || !canManageDirectory(session.user.role)) {
    return { ok: false, message: "You do not have permission.", results: [] };
  }

  const uniqueIds = [...new Set(registrationIds.map((id) => id.trim()).filter(Boolean))];
  if (uniqueIds.length === 0) {
    return { ok: false, message: "No registrations selected.", results: [] };
  }

  const regs = await prisma.registration.findMany({
    where: { id: { in: uniqueIds } },
    include: {
      child: { include: { guardian: true } },
      season: true,
    },
  });

  if (regs.length === 0) {
    return {
      ok: false,
      message: "No registrations found.",
      results: uniqueIds.map(() => ({ ok: false, message: "Registration not found." })),
    };
  }

  type RemovalGroup = {
    guardianId: string;
    seasonId: string;
    guardianEmail: string | null;
    guardianName: string;
    seasonName: string;
    children: Array<{ firstName: string; lastName: string }>;
    registrationIds: string[];
  };

  const groups = new Map<string, RemovalGroup>();
  for (const reg of regs) {
    const guardian = reg.child.guardian;
    const key = `${guardian.id}::${reg.seasonId}`;
    const existing = groups.get(key);
    if (existing) {
      existing.registrationIds.push(reg.id);
      existing.children.push({
        firstName: reg.child.firstName,
        lastName: reg.child.lastName,
      });
    } else {
      groups.set(key, {
        guardianId: guardian.id,
        seasonId: reg.seasonId,
        guardianEmail: guardian.email,
        guardianName: `${guardian.firstName} ${guardian.lastName}`.trim(),
        seasonName: reg.season.name,
        children: [{ firstName: reg.child.firstName, lastName: reg.child.lastName }],
        registrationIds: [reg.id],
      });
    }
  }

  const emailByGuardianSeason = new Map<string, EmailSendResult>();
  for (const [key, group] of groups) {
    if (!group.guardianEmail?.trim()) {
      emailByGuardianSeason.set(key, "skipped_no_email");
      continue;
    }
    const emailResult = await sendRegistrationsRemovedEmail({
      guardianEmail: group.guardianEmail,
      guardianName: group.guardianName,
      seasonId: group.seasonId,
      children: group.children,
    });
    emailByGuardianSeason.set(key, emailResult);
  }

  await removeRegistrationRows(regs.map((r) => r.id));

  const seasonIds = new Set(regs.map((r) => r.seasonId));
  for (const seasonId of seasonIds) {
    revalidateRegistrationPaths(seasonId);
  }

  const results: RegActionState[] = uniqueIds.map((id) => {
    const reg = regs.find((r) => r.id === id);
    if (!reg) return { ok: false, message: "Registration not found." };
    const key = `${reg.child.guardian.id}::${reg.seasonId}`;
    const emailResult = emailByGuardianSeason.get(key) ?? "skipped_no_email";
    const childLabel = `${reg.child.firstName} ${reg.child.lastName}`.trim();
    return {
      ok: true,
      message: `${childLabel}: Removed.${formatCancellationEmailHint(emailResult)}`,
    };
  });

  const sentCount = [...emailByGuardianSeason.values()].filter((r) => r === "sent").length;
  const summary =
    uniqueIds.length === 1
      ? results[0]?.message ?? "Registration removed."
      : `Removed ${regs.length} registration(s).${sentCount > 0 ? ` ${sentCount} cancellation email(s) sent.` : ""}`;

  return { ok: true, message: summary, results };
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
    select: {
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
  if (!reg.expectsPayment) {
    return { ok: false, message: "Turn on “expects payment” for this registration first." };
  }
  if (registrationPaymentIsComplete(reg)) {
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
    data: {
      expectsPayment,
      // Manual paid date overrides the Due badge; clear it when fee tracking changes.
      paymentReceivedAt: null,
    },
  });

  revalidatePath(`/registrations/${registrationId}`);
  revalidatePath("/registrations");
  return {
    ok: true,
    message: expectsPayment
      ? "Marked as expecting payment — status will show Due on the list."
      : "Payment expectation cleared.",
  };
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
  revalidatePath("/registrations");
  return { ok: true, message: "Payment marked as received." };
}

export async function markRegistrationPaymentDue(registrationId: string): Promise<RegActionState> {
  const session = await auth();
  if (!session?.user?.role || !canManageDirectory(session.user.role)) {
    return { ok: false, message: "You do not have permission." };
  }

  const reg = await prisma.registration.findUnique({
    where: { id: registrationId },
    select: {
      expectsPayment: true,
      paymentReceivedAt: true,
      formSubmission: { select: { stripePaymentStatus: true } },
    },
  });
  if (!reg) return { ok: false, message: "Registration not found." };

  const showsPaid = registrationListShowsPaid({
    expectsPayment: reg.expectsPayment,
    paymentReceivedAt: reg.paymentReceivedAt,
    formSubmission: reg.formSubmission,
  });
  if (!showsPaid) {
    return { ok: false, message: "Payment is already marked as due." };
  }

  await prisma.registration.update({
    where: { id: registrationId },
    data: {
      paymentReceivedAt: null,
      expectsPayment: true,
    },
  });

  revalidatePath(`/registrations/${registrationId}`);
  revalidatePath("/registrations");
  return { ok: true, message: "Payment marked as due again." };
}

export async function bulkSendPaymentRemindersAction(
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
      id: true,
      expectsPayment: true,
      paymentReceivedAt: true,
      seasonId: true,
      child: { select: { guardianId: true } },
    },
  });

  const seenFamilies = new Set<string>();
  const toSend: string[] = [];
  for (const reg of regs) {
    if (!reg.expectsPayment || reg.paymentReceivedAt) continue;
    const familyKey = `${reg.child.guardianId}::${reg.seasonId}`;
    if (seenFamilies.has(familyKey)) continue;
    seenFamilies.add(familyKey);
    toSend.push(reg.id);
  }

  if (toSend.length === 0) {
    return {
      ok: false,
      message: "None of the selected rows expect payment or still have payment outstanding with an email on file.",
    };
  }

  let sent = 0;
  let failed = 0;
  let skippedNoEmail = 0;
  for (const registrationId of toSend) {
    const r = await sendPaymentReminderEmail(registrationId);
    if (r === "sent") sent += 1;
    else if (r === "skipped_no_email") skippedNoEmail += 1;
    else failed += 1;
  }

  revalidatePath("/registrations");
  if (sent === 0) {
    const hint =
      skippedNoEmail > 0
        ? " Guardians may be missing email addresses."
        : " Check email config and payment status.";
    return { ok: false, message: `Could not send any payment reminders.${hint}` };
  }
  const skipNote =
    skippedNoEmail + failed > 0
      ? ` ${skippedNoEmail + failed} could not be sent (missing email or ineligible).`
      : "";
  return {
    ok: true,
    message: `Payment reminder sent for ${sent} famil${sent === 1 ? "y" : "ies"}.${skipNote}`,
  };
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
