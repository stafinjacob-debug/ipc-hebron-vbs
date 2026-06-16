/**
 * Stripe Checkout for public VBS registration — server-only.
 */
import { prisma } from "@/lib/prisma";
import { getPublicAppBaseUrl } from "@/lib/public-app-url";
import { getPortalPublicPath } from "@/lib/portal-public-path";
import {
  computeProcessingGrossUp,
  computeRegistrationBaseCents,
  includeProcessingFeeForMode,
} from "@/lib/stripe-fee-math";
import Stripe from "stripe";

export function getStripeClient(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) return null;
  return new Stripe(key);
}

/** True when staff re-opened payment on at least one active registration on this submission. */
export async function submissionHasOutstandingRegistrationPayment(
  formSubmissionId: string,
): Promise<boolean> {
  const count = await prisma.registration.count({
    where: {
      formSubmissionId,
      status: { not: "CANCELLED" },
      expectsPayment: true,
      paymentReceivedAt: null,
    },
  });
  return count > 0;
}

/** After admin marks payment due again, allow a fresh Stripe checkout for the family. */
export async function clearFormSubmissionStripePaymentState(formSubmissionId: string): Promise<void> {
  await prisma.formSubmission.update({
    where: { id: formSubmissionId },
    data: {
      stripePaymentStatus: null,
      stripePaidAt: null,
      stripeCheckoutSessionId: null,
    },
  });
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
  successUrl?: string;
  cancelUrl?: string;
}): Promise<{ url: string; sessionId: string } | { error: string }> {
  const stripe = getStripeClient();
  if (!stripe) {
    return { error: "Stripe is not configured on the server (missing STRIPE_SECRET_KEY)." };
  }
  if (params.totalCents < 50) {
    return { error: "The payment amount is too small for card checkout." };
  }

  const base = getPublicAppBaseUrl();
  const successUrl =
    params.successUrl ?? `${base}/register/thanks?session_id={CHECKOUT_SESSION_ID}`;

  let cancelUrl = params.cancelUrl;
  if (!cancelUrl) {
    const season = await prisma.vbsSeason.findUnique({
      where: { id: params.seasonId },
      select: { id: true, publicRegistrationSlug: true },
    });
    const portalPath = getPortalPublicPath(season ?? { publicRegistrationSlug: null });
    if (season?.publicRegistrationSlug) {
      cancelUrl = `${base}${portalPath}?payment=canceled`;
    } else {
      cancelUrl = `${base}${portalPath}?season=${encodeURIComponent(params.seasonId)}&payment=canceled`;
    }
  }

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

/** Open Stripe Checkout URL for an unpaid submission (reuses open session or creates a new one). */
export async function resolveCheckoutResumeUrlForSubmission(
  formSubmissionId: string,
  options?: { cancelUrl?: string },
): Promise<{ url: string } | { error: string }> {
  const stripe = getStripeClient();
  if (!stripe) {
    return { error: "Stripe is not configured on the server (missing STRIPE_SECRET_KEY)." };
  }

  const submission = await prisma.formSubmission.findUnique({
    where: { id: formSubmissionId },
    include: {
      guardian: true,
      season: true,
      form: {
        select: {
          stripeProductLabel: true,
          stripeAmountCents: true,
          stripePricingUnit: true,
          stripeCapPaidChildrenAtThree: true,
          stripeProcessingFeeMode: true,
        },
      },
      _count: { select: { registrations: true } },
    },
  });
  if (!submission) return { error: "Registration submission not found." };

  const paymentReopened = await submissionHasOutstandingRegistrationPayment(formSubmissionId);

  const stripeStatus = (submission.stripePaymentStatus ?? "").toLowerCase();
  if (
    !paymentReopened &&
    (stripeStatus === "paid" || submission.stripePaidAt)
  ) {
    return { error: "Payment has already been completed for this registration." };
  }

  if (submission.stripeCheckoutSessionId) {
    try {
      const existing = await stripe.checkout.sessions.retrieve(submission.stripeCheckoutSessionId);
      if (existing.status === "complete" && !paymentReopened) {
        return { error: "Payment has already been completed for this registration." };
      }
      if (!paymentReopened && existing.status === "open" && existing.url) {
        return { url: existing.url };
      }
    } catch (err) {
      console.error("[resolveCheckoutResumeUrl] retrieve session", err);
    }
  }

  let totalCents = submission.stripeAmountChargedCents ?? 0;
  let baseCents = totalCents;
  let processingCents = 0;
  let coverProcessingFee = submission.stripeCoverProcessingFee ?? false;

  if (submission.stripeCheckoutSessionId) {
    try {
      const prior = await stripe.checkout.sessions.retrieve(submission.stripeCheckoutSessionId);
      const m = prior.metadata ?? {};
      const t = Number.parseInt(m.vbsTotalCents ?? "", 10);
      const b = Number.parseInt(m.vbsBaseCents ?? "", 10);
      const p = Number.parseInt(m.vbsProcessingCents ?? "", 10);
      if (Number.isFinite(t) && t >= 50) totalCents = t;
      if (Number.isFinite(b) && b > 0) baseCents = b;
      if (Number.isFinite(p) && p >= 0) processingCents = p;
      if (m.vbsCoverFee === "1" || m.vbsCoverFee === "0") {
        coverProcessingFee = m.vbsCoverFee === "1";
      }
    } catch (err) {
      console.error("[resolveCheckoutResumeUrl] read prior session metadata", err);
    }
  }

  if (totalCents < 50 && submission.form?.stripeAmountCents) {
    const childCount = Math.max(1, submission._count.registrations);
    baseCents = computeRegistrationBaseCents(
      submission.form.stripePricingUnit,
      submission.form.stripeAmountCents,
      childCount,
      submission.form.stripeCapPaidChildrenAtThree,
    );
    coverProcessingFee = includeProcessingFeeForMode(
      submission.form.stripeProcessingFeeMode,
      false,
    );
    const computed = computeProcessingGrossUp(baseCents, coverProcessingFee);
    totalCents = computed.totalCents;
    processingCents = computed.processingCents;
  }

  if (totalCents < 50) {
    return { error: "Checkout amount is missing or too small to resume payment online." };
  }

  const productLabel =
    submission.form?.stripeProductLabel?.trim() ||
    `${submission.season.name} — VBS registration`;

  return createRegistrationStripeCheckoutSession({
    formSubmissionId: submission.id,
    seasonId: submission.seasonId,
    productLabel,
    guardianEmail: submission.guardian.email,
    baseCents,
    totalCents,
    processingCents,
    coverProcessingFee,
    cancelUrl: options?.cancelUrl,
  });
}
