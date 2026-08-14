import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getStripeClient } from "@/lib/stripe-registration-payment";
import { markEmbeddedSubmissionPaidFromStripeSession } from "@/lib/embedded-stripe-payment";
import { sendEmbeddedApplicationReceivedEmail } from "@/lib/email/embedded-application-email";
import { formatUsdFromCents } from "@/lib/stripe-fee-math";

export default async function EmbeddedFormThanksPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    ref?: string;
    session_id?: string;
    payment?: string;
    submission?: string;
  }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const form = await prisma.embeddedForm.findUnique({ where: { slug } });
  if (!form) notFound();

  let applicationNumber = sp.ref?.trim() || "";
  let paymentStatus: string | null = null;
  let chargedCents: number | null = null;
  let message = form.confirmationMessage ||
    "Thank you. Someone from our team will review your application and contact you.";

  if (sp.session_id?.trim()) {
    const stripe = getStripeClient();
    if (stripe) {
      try {
        const session = await stripe.checkout.sessions.retrieve(sp.session_id.trim());
        const submissionId = session.metadata?.embeddedFormSubmissionId?.trim();
        if (submissionId && session.payment_status === "paid") {
          await markEmbeddedSubmissionPaidFromStripeSession({
            submissionId,
            amountTotal: session.amount_total ?? null,
          });
          const submission = await prisma.embeddedFormSubmission.findUnique({
            where: { id: submissionId },
          });
          if (submission) {
            applicationNumber = submission.applicationNumber;
            paymentStatus = "paid";
            chargedCents = submission.stripeAmountChargedCents;
            if (!submission.applicationReceivedEmailSentAt) {
              void sendEmbeddedApplicationReceivedEmail(submission.id).catch((err) => {
                console.error("[embedded thanks email]", err);
              });
            }
            message =
              form.confirmationMessage ||
              "Your application and payment have been received. Someone from our admissions team will review your materials and contact you.";
          }
        }
      } catch (e) {
        console.error("[embedded thanks stripe retrieve]", e);
      }
    }
  } else if (sp.payment === "canceled" && sp.submission?.trim()) {
    const submission = await prisma.embeddedFormSubmission.findUnique({
      where: { id: sp.submission.trim() },
    });
    if (submission && submission.formId === form.id) {
      applicationNumber = submission.applicationNumber;
      paymentStatus = submission.stripePaymentStatus;
      message =
        "Your application was saved, but payment was not completed. Please return to the form and submit again to finish paying the application fee, or contact admissions with your reference number.";
    }
  } else if (applicationNumber) {
    const submission = await prisma.embeddedFormSubmission.findUnique({
      where: { applicationNumber },
    });
    if (submission) {
      paymentStatus = submission.stripePaymentStatus;
      chargedCents = submission.stripeAmountChargedCents;
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-50 to-indigo-50/40 px-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">
          {paymentStatus === "paid"
            ? "Application & payment received"
            : paymentStatus === "pending"
              ? "Application saved — payment needed"
              : "Application received"}
        </p>
        <h1 className="mt-3 text-2xl font-bold text-slate-900">{form.title}</h1>
        {applicationNumber ? (
          <p className="mt-4 rounded-xl bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
            Your reference number is <strong>{applicationNumber}</strong>
          </p>
        ) : null}
        {paymentStatus === "paid" && chargedCents != null ? (
          <p className="mt-3 text-sm text-slate-600">
            Amount paid: <strong>{formatUsdFromCents(chargedCents)}</strong>
          </p>
        ) : null}
        <p className="mt-4 text-sm leading-relaxed text-slate-600">{message}</p>
        {form.instructions ? (
          <p className="mt-4 text-left text-xs leading-relaxed text-slate-500">{form.instructions}</p>
        ) : null}
        <p className="mt-6 text-xs text-slate-500">
          {[form.helpEmail, form.helpPhone].filter(Boolean).join(" · ")}
        </p>
        <Link href={`/forms/${slug}`} className="mt-6 inline-block text-sm text-indigo-600 hover:underline">
          Return to form
        </Link>
      </div>
    </main>
  );
}
