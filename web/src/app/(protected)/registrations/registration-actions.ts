"use server";

import { auth } from "@/auth";
import {
  sendPaymentReminderEmail,
  sendRegistrationApprovedEmail,
} from "@/lib/email/registration-emails";
import { tryAutoAssignRegistration } from "@/lib/class-assignment";
import { makeCheckInToken, makeUniqueRegistrationNumber } from "@/lib/registration-identity";
import { prisma } from "@/lib/prisma";
import { canManageDirectory } from "@/lib/roles";
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
    select: { id: true, status: true, seasonId: true },
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

  const emailResult = await sendRegistrationApprovedEmail(registrationId, { recordSentTimestamp: true });
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
    select: { id: true, seasonId: true },
  });
  if (!reg) return { ok: false, message: "Registration not found." };

  await prisma.registration.update({
    where: { id: registrationId },
    data: { status: "CANCELLED" },
  });

  revalidateRegistrationPaths(reg.seasonId);
  revalidatePath(`/registrations/${registrationId}`);
  return { ok: true, message: "Registration declined (cancelled)." };
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
