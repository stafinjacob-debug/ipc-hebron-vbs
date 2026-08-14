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
  const cancelUrl = `${base}/forms/${encodeURIComponent(params.formSlug)}/thanks?payment=canceled&submission=${encodeURIComponent(params.submissionId)}`;

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
}

export async function markEmbeddedSubmissionPaidFromStripeSession(args: {
  submissionId: string;
  amountTotal: number | null;
}): Promise<boolean> {
  const existing = await prisma.embeddedFormSubmission.findUnique({
    where: { id: args.submissionId },
    select: { stripePaymentStatus: true },
  });
  if (!existing) return false;
  if (existing.stripePaymentStatus === "paid") return true;

  const paidAt = new Date();
  await prisma.embeddedFormSubmission.update({
    where: { id: args.submissionId },
    data: {
      stripePaymentStatus: "paid",
      stripePaidAt: paidAt,
      ...(args.amountTotal != null && args.amountTotal > 0
        ? { stripeAmountChargedCents: args.amountTotal }
        : {}),
    },
  });
  return true;
}
