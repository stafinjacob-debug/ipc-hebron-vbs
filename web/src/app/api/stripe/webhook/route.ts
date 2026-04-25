import { prisma } from "@/lib/prisma";
import { sendSubmissionReceivedEmail } from "@/lib/email/registration-emails";
import { getStripeClient } from "@/lib/stripe-registration-payment";
import type Stripe from "stripe";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const stripe = getStripeClient();
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!stripe || !whSecret) {
    return new Response("Stripe webhook is not configured.", { status: 503 });
  }

  const body = await request.text();
  const sig = request.headers.get("stripe-signature");
  if (!sig) {
    return new Response("Missing stripe-signature", { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, whSecret);
  } catch (e) {
    console.error("[stripe webhook] signature", e);
    return new Response("Invalid signature", { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.mode !== "payment" || session.payment_status !== "paid") {
      return new Response("ok", { status: 200 });
    }

    const submissionId = session.metadata?.vbsFormSubmissionId?.trim();
    if (!submissionId) {
      return new Response("ok", { status: 200 });
    }

    const existing = await prisma.formSubmission.findUnique({
      where: { id: submissionId },
      select: { stripePaymentStatus: true },
    });
    if (!existing) {
      return new Response("ok", { status: 200 });
    }
    if (existing.stripePaymentStatus === "paid") {
      return new Response("ok", { status: 200 });
    }

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
      console.error("[stripe webhook] sendSubmissionReceivedEmail", err);
    });
  }

  return new Response("ok", { status: 200 });
}
