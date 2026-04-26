/**
 * Stripe Checkout for public VBS registration — server-only.
 */
import { prisma } from "@/lib/prisma";
import { getPublicAppBaseUrl } from "@/lib/public-app-url";
import Stripe from "stripe";

export function getStripeClient(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) return null;
  return new Stripe(key);
}

export async function createRegistrationStripeCheckoutSession(params: {
  formSubmissionId: string;
  seasonId: string;
  productLabel: string;
  guardianEmail: string | null;
  baseCents: number;
  totalCents: number;
  processingCents: number;
  coverProcessingFee: boolean;
}): Promise<{ url: string; sessionId: string } | { error: string }> {
  const stripe = getStripeClient();
  if (!stripe) {
    return { error: "Stripe is not configured on the server (missing STRIPE_SECRET_KEY)." };
  }
  if (params.totalCents < 50) {
    return { error: "The payment amount is too small for card checkout." };
  }

  const base = getPublicAppBaseUrl();
  const successUrl = `${base}/register/thanks?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${base}/register?season=${encodeURIComponent(params.seasonId)}&payment=canceled`;

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: params.guardianEmail?.trim() || undefined,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: params.totalCents,
          product_data: {
            name: params.productLabel.slice(0, 120),
          },
        },
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      vbsFormSubmissionId: params.formSubmissionId,
      vbsSeasonId: params.seasonId,
      vbsBaseCents: String(params.baseCents),
      vbsProcessingCents: String(params.processingCents),
      vbsTotalCents: String(params.totalCents),
      vbsCoverFee: params.coverProcessingFee ? "1" : "0",
    },
    payment_intent_data: {
      metadata: {
        vbsFormSubmissionId: params.formSubmissionId,
      },
    },
  });

  if (!session.url) {
    return { error: "Stripe did not return a checkout URL." };
  }

  await prisma.formSubmission.update({
    where: { id: params.formSubmissionId },
    data: {
      stripeCheckoutSessionId: session.id,
      stripePaymentStatus: "pending",
      stripeAmountChargedCents: params.totalCents,
      stripeCoverProcessingFee: params.coverProcessingFee,
    },
  });

  return { url: session.url, sessionId: session.id };
}
