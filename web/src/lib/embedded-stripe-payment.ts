import { prisma } from "@/lib/prisma";
import { getPublicAppBaseUrl } from "@/lib/public-app-url";
import { computeProcessingGrossUp } from "@/lib/stripe-fee-math";
import { getStripeClient } from "@/lib/stripe-registration-payment";

export async function createEmbeddedApplicationStripeCheckout(params: {
  submissionId: string;
  formSlug: string;
  applicantEmail: string | null;
  productLabel: string;
  baseCents: number;
  includeProcessingFee: boolean;
  cancelUrl?: string;
}): Promise<{ url: string; sessionId: string; totalCents: number; processingCents: number } | { error: string }> {
  const stripe = getStripeClient();
  if (!stripe) {
    return { error: "Stripe is not configured on the server (missing STRIPE_SECRET_KEY)." };
  }
  if (params.baseCents < 50) {
    return { error: "The application fee amount is too small for card checkout." };
  }

  const { totalCents, processingCents } = computeProcessingGrossUp(
    params.baseCents,
    params.includeProcessingFee,
  );
  if (totalCents < 50) {
    return { error: "The payment amount is too small for card checkout." };
  }

  const base = getPublicAppBaseUrl();
  const successUrl = `${base}/forms/${encodeURIComponent(params.formSlug)}/thanks?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl =
    params.cancelUrl ??
    `${base}/forms/${encodeURIComponent(params.formSlug)}/pay?submission=${encodeURIComponent(params.submissionId)}`;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: params.applicantEmail?.trim() || undefined,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: totalCents,
            product_data: {
              name: params.productLabel.slice(0, 120),
              description: params.includeProcessingFee
                ? `Includes estimated card processing so the college receives $${(params.baseCents / 100).toFixed(2)}.`
                : undefined,
            },
          },
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        embeddedFormSubmissionId: params.submissionId,
        embeddedBaseCents: String(params.baseCents),
        embeddedProcessingCents: String(processingCents),
        embeddedTotalCents: String(totalCents),
      },
      payment_intent_data: {
        metadata: {
          embeddedFormSubmissionId: params.submissionId,
        },
      },
    });

    if (!session.url) {
      return { error: "Stripe did not return a checkout URL." };
    }

    await prisma.embeddedFormSubmission.update({
      where: { id: params.submissionId },
      data: {
        stripeCheckoutSessionId: session.id,
        stripePaymentStatus: "pending",
        stripeAmountChargedCents: totalCents,
        stripeBaseCents: params.baseCents,
        stripeProcessingCents: processingCents,
      },
    });

    return {
      url: session.url,
      sessionId: session.id,
      totalCents,
      processingCents,
    };
  } catch (e) {
    console.error("[embedded stripe checkout]", e);
    return { error: "Could not start card payment. Please try again or contact admissions." };
  }
}

/** Reuse an open Stripe session or create a new one for the application fee. */
export async function resolveEmbeddedCheckoutUrl(params: {
  submissionId: string;
  formSlug: string;
  applicantEmail: string | null;
  productLabel: string;
  baseCents: number;
  includeProcessingFee: boolean;
}): Promise<
  | { url: string; totalCents: number; processingCents: number }
  | { error: string }
> {
  const stripe = getStripeClient();
  if (!stripe) {
    return { error: "Stripe is not configured on the server (missing STRIPE_SECRET_KEY)." };
  }

  const submission = await prisma.embeddedFormSubmission.findUnique({
    where: { id: params.submissionId },
    select: {
      stripePaymentStatus: true,
      stripeCheckoutSessionId: true,
      stripeAmountChargedCents: true,
      stripeBaseCents: true,
      stripeProcessingCents: true,
    },
  });
  if (!submission) return { error: "Application not found." };
  if ((submission.stripePaymentStatus ?? "").toLowerCase() === "paid") {
    return { error: "Payment has already been completed for this application." };
  }

  if (submission.stripeCheckoutSessionId) {
    try {
      const existing = await stripe.checkout.sessions.retrieve(submission.stripeCheckoutSessionId);
      if (existing.status === "complete") {
        return { error: "Payment has already been completed for this application." };
      }
      if (existing.status === "open" && existing.url) {
        const totalCents =
          existing.amount_total ??
          submission.stripeAmountChargedCents ??
          computeProcessingGrossUp(params.baseCents, params.includeProcessingFee).totalCents;
        const processingCents =
          submission.stripeProcessingCents ??
          computeProcessingGrossUp(params.baseCents, params.includeProcessingFee).processingCents;
        return { url: existing.url, totalCents, processingCents };
      }
    } catch (err) {
      console.error("[resolveEmbeddedCheckoutUrl] retrieve session", err);
    }
  }

  const created = await createEmbeddedApplicationStripeCheckout({
    ...params,
    cancelUrl: `${getPublicAppBaseUrl()}/forms/${encodeURIComponent(params.formSlug)}/pay?submission=${encodeURIComponent(params.submissionId)}`,
  });
  if ("error" in created) return created;
  return {
    url: created.url,
    totalCents: created.totalCents,
    processingCents: created.processingCents,
  };
}

export async function markEmbeddedSubmissionPaidFromStripeSession(args: {
  submissionId: string;
  amountTotal: number | null;
  paymentIntentId?: string | null;
}): Promise<boolean> {
  const existing = await prisma.embeddedFormSubmission.findUnique({
    where: { id: args.submissionId },
    select: { stripePaymentStatus: true },
  });
  if (!existing) return false;
  if (existing.stripePaymentStatus === "paid") {
    if (args.paymentIntentId?.trim()) {
      await prisma.embeddedFormSubmission.update({
        where: { id: args.submissionId },
        data: { stripePaymentIntentId: args.paymentIntentId.trim() },
      });
    }
    return true;
  }

  const paidAt = new Date();
  await prisma.embeddedFormSubmission.update({
    where: { id: args.submissionId },
    data: {
      stripePaymentStatus: "paid",
      stripePaidAt: paidAt,
      ...(args.amountTotal != null && args.amountTotal > 0
        ? { stripeAmountChargedCents: args.amountTotal }
        : {}),
      ...(args.paymentIntentId?.trim()
        ? { stripePaymentIntentId: args.paymentIntentId.trim() }
        : {}),
    },
  });
  return true;
}
