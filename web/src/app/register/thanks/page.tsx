import Link from "next/link";
import { redirect } from "next/navigation";
import { sendSubmissionReceivedEmail } from "@/lib/email/registration-emails";
import { prisma } from "@/lib/prisma";
import { getStripeClient } from "@/lib/stripe-registration-payment";
import { RegisterThanksView } from "./register-thanks-view";

export const dynamic = "force-dynamic";

export default async function RegisterThanksPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const sp = await searchParams;
  const sessionId = typeof sp.session_id === "string" ? sp.session_id.trim() : "";
  if (!sessionId) {
    redirect("/register");
  }

  const stripe = getStripeClient();
  if (!stripe) {
    return (
      <div className="min-h-dvh bg-[#070b10] px-4 py-16 text-center text-neutral-200">
        <div className="mx-auto max-w-lg rounded-2xl border border-white/10 bg-neutral-950/80 px-6 py-10 backdrop-blur-xl">
          <p className="text-sm leading-relaxed text-neutral-300">
            Payment confirmation is unavailable. If you completed checkout, your registration is still on file —
            contact the church office with your email and child names.
          </p>
          <Link
            href="/register"
            className="mt-8 inline-flex min-h-11 items-center justify-center rounded-full bg-gradient-to-r from-teal-400 to-sky-500 px-6 text-sm font-semibold text-neutral-950"
          >
            Back to registration
          </Link>
        </div>
      </div>
    );
  }

  let session: Awaited<ReturnType<typeof stripe.checkout.sessions.retrieve>>;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch {
    redirect("/register");
  }

  const paid = session.payment_status === "paid";
  const seasonId = session.metadata?.vbsSeasonId?.trim() ?? "";
  const submissionId = session.metadata?.vbsFormSubmissionId?.trim() ?? "";

  // Fallback safety net for local/dev testing: if webhook delivery is not configured yet,
  // mark this submission paid when Stripe says this Checkout Session is paid.
  if (paid && submissionId) {
    const existing = await prisma.formSubmission.findUnique({
      where: { id: submissionId },
      select: { stripePaymentStatus: true },
    });
    if (existing && existing.stripePaymentStatus !== "paid") {
      const paidAt = new Date();
      const charged =
        typeof session.amount_total === "number" && session.amount_total > 0
          ? session.amount_total
          : null;
      await prisma.$transaction([
        prisma.formSubmission.update({
          where: { id: submissionId },
          data: {
            stripePaymentStatus: "paid",
            stripePaidAt: paidAt,
            ...(charged != null ? { stripeAmountChargedCents: charged } : {}),
          },
        }),
        prisma.registration.updateMany({
          where: { formSubmissionId: submissionId },
          data: {
            paymentReceivedAt: paidAt,
            expectsPayment: false,
          },
        }),
      ]);
      void sendSubmissionReceivedEmail(submissionId).catch((err) => {
        console.error("[register/thanks] sendSubmissionReceivedEmail", err);
      });
    }
  }

  let seasonName: string | null = null;
  if (seasonId) {
    const row = await prisma.vbsSeason.findUnique({
      where: { id: seasonId },
      select: { name: true },
    });
    seasonName = row?.name ?? null;
  }

  const contactEmail = process.env.NEXT_PUBLIC_VBS_CONTACT_EMAIL?.trim() ?? "";

  return (
    <RegisterThanksView paid={paid} seasonName={seasonName} contactEmail={contactEmail} />
  );
}
