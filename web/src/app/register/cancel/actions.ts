"use server";

import { prisma } from "@/lib/prisma";
import { verifySubmissionPublicToken } from "@/lib/registration-public-token";

export type CancelByTokenState = { ok: boolean; message: string };

export async function cancelSubmissionByTokenAction(token: string): Promise<CancelByTokenState> {
  const verified = verifySubmissionPublicToken(token, "cancel");
  if (!verified) {
    return {
      ok: false,
      message: "This cancel link is invalid or has expired. Please contact the church office for help.",
    };
  }

  const submission = await prisma.formSubmission.findUnique({
    where: { id: verified.submissionId },
    include: {
      registrations: {
        where: { status: { notIn: ["CANCELLED", "CHECKED_OUT"] } },
        select: { id: true },
      },
    },
  });
  if (!submission) {
    return { ok: false, message: "We could not find that registration." };
  }
  if (submission.registrations.length === 0) {
    return { ok: true, message: "This registration has already been cancelled." };
  }

  const stripeStatus = (submission.stripePaymentStatus ?? "").toLowerCase();
  if (stripeStatus === "paid" || submission.stripePaidAt) {
    return {
      ok: false,
      message:
        "Payment has already been received for this registration. Please contact the church office if you need to make a change.",
    };
  }

  await prisma.$transaction([
    prisma.registration.updateMany({
      where: {
        formSubmissionId: submission.id,
        status: { notIn: ["CANCELLED", "CHECKED_OUT"] },
      },
      data: { status: "CANCELLED" },
    }),
    prisma.formSubmission.update({
      where: { id: submission.id },
      data: { stripePaymentStatus: "canceled" },
    }),
  ]);

  return {
    ok: true,
    message:
      "Your registration has been cancelled. You will not be charged for this submission. If you change your mind, you may register again on our website.",
  };
}
