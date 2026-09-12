import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { resolveEmbeddedCheckoutUrl } from "@/lib/embedded-stripe-payment";
import { formatUsdFromCents } from "@/lib/stripe-fee-math";
import { EmbeddedPayClient } from "./embedded-pay-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pay application fee",
};

export default async function EmbeddedFormPayPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ submission?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const submissionId = sp.submission?.trim() || "";

  const form = await prisma.embeddedForm.findUnique({ where: { slug } });
  if (!form || form.status !== "PUBLISHED") notFound();

  if (!submissionId) {
    return (
      <PayShell title={form.title} heading="Payment link incomplete">
        <p className="text-sm leading-relaxed text-slate-600">
          This payment link is missing the application reference. Return to the form and submit
          again, or contact admissions with your application number.
        </p>
        <Link href={`/forms/${slug}`} className="mt-6 inline-block text-sm text-indigo-600 hover:underline">
          Return to form
        </Link>
      </PayShell>
    );
  }

  const submission = await prisma.embeddedFormSubmission.findUnique({
    where: { id: submissionId },
  });
  if (!submission || submission.formId !== form.id) notFound();

  if ((submission.stripePaymentStatus ?? "").toLowerCase() === "paid") {
    redirect(`/forms/${slug}/thanks?ref=${encodeURIComponent(submission.applicationNumber)}`);
  }

  if (!form.stripeCheckoutEnabled || (form.stripeAmountCents ?? 0) < 50) {
    redirect(`/forms/${slug}/thanks?ref=${encodeURIComponent(submission.applicationNumber)}`);
  }

  let checkout:
    | { url: string; totalCents: number; processingCents: number }
    | { error: string };
  try {
    checkout = await resolveEmbeddedCheckoutUrl({
      submissionId: submission.id,
      formSlug: form.slug,
      applicantEmail: submission.applicantEmail,
      productLabel: form.stripeProductLabel?.trim() || `${form.title} — Application Fee`,
      baseCents: form.stripeAmountCents!,
      includeProcessingFee: form.stripeIncludeProcessingFee,
    });
  } catch (e) {
    console.error("[embedded pay page]", e);
    checkout = { error: "Could not start card payment. Please try again or contact admissions." };
  }

  if ("error" in checkout) {
    return (
      <PayShell title={form.title} heading="Payment could not be started">
        <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-900">{checkout.error}</p>
        <p className="mt-4 text-sm text-slate-600">
          Your application is saved as <strong>{submission.applicationNumber}</strong>. You can
          retry payment or contact admissions with that reference.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-4 text-sm">
          <Link
            href={`/forms/${slug}/pay?submission=${encodeURIComponent(submission.id)}`}
            className="font-medium text-indigo-600 hover:underline"
          >
            Try again
          </Link>
          <Link href={`/forms/${slug}`} className="text-slate-500 hover:underline">
            Return to form
          </Link>
        </div>
      </PayShell>
    );
  }

  return (
    <PayShell title={form.title} heading="Pay your application fee">
      <p className="mt-4 rounded-xl bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
        Reference <strong>{submission.applicationNumber}</strong>
      </p>
      <p className="mt-4 text-sm leading-relaxed text-slate-600">
        Amount due: <strong>{formatUsdFromCents(checkout.totalCents)}</strong>
        {checkout.processingCents > 0
          ? ` (includes estimated card processing so the college receives ${formatUsdFromCents(form.stripeAmountCents!)}).`
          : "."}
      </p>
      <EmbeddedPayClient
        checkoutUrl={checkout.url}
        amountLabel={formatUsdFromCents(checkout.totalCents)}
      />
    </PayShell>
  );
}

function PayShell({
  title,
  heading,
  children,
}: {
  title: string;
  heading: string;
  children: ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-50 to-indigo-50/40 px-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">
          {heading}
        </p>
        <h1 className="mt-3 text-2xl font-bold text-slate-900">{title}</h1>
        {children}
      </div>
    </main>
  );
}
