"use client";

import { useEffect, useState, useTransition } from "react";
import { VBS_PAYMENT_DEADLINE_NOTICE } from "@/lib/pay-later";
import type { RegistrantPaymentDisplay } from "@/lib/registrant-lookup-payment";
import { startRegistrantLookupPaymentAction } from "../actions";

export function RegistrantPaymentSection({
  payment,
  paymentCanceled,
}: {
  payment: RegistrantPaymentDisplay;
  paymentCanceled?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (paymentCanceled) {
      setError(true);
      setMessage("Checkout was canceled. You can try again when you are ready.");
    }
  }, [paymentCanceled]);

  if (payment.label === "Not required") {
    return null;
  }

  const isPaid = payment.label === "Paid";

  return (
    <section className="space-y-3 rounded-xl border border-foreground/10 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Payment</h2>
        <span className={payment.className}>{payment.label}</span>
      </div>

      {isPaid ? (
        <p className="text-sm text-muted">Thank you — your registration payment is on file.</p>
      ) : null}

      {!isPaid && payment.amountDueLabel ? (
        <p className="text-sm text-muted">
          Amount due: <span className="font-medium text-foreground">{payment.amountDueLabel}</span>
        </p>
      ) : null}

      {!isPaid && payment.canPayOnline ? (
        <>
          <p className="text-xs leading-relaxed text-muted">{VBS_PAYMENT_DEADLINE_NOTICE}</p>
          <button
            type="button"
            disabled={pending || !payment.stripeConfigured}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-foreground hover:opacity-90 disabled:opacity-50"
            onClick={() => {
              setMessage(null);
              setError(false);
              startTransition(async () => {
                const r = await startRegistrantLookupPaymentAction();
                const url = r.stripeCheckoutUrl?.trim();
                if (r.ok && url) {
                  window.location.href = url;
                  return;
                }
                setError(!r.ok);
                setMessage(r.message);
              });
            }}
          >
            {pending
              ? "Opening checkout…"
              : payment.checkoutPending
                ? "Continue checkout"
                : "Pay now"}
          </button>
          {!payment.stripeConfigured ? (
            <p className="text-xs text-amber-800 dark:text-amber-200">
              Online card payment is temporarily unavailable. Contact the VBS team to pay.
            </p>
          ) : null}
        </>
      ) : !isPaid && payment.label.startsWith("Due") ? (
        <p className="text-xs leading-relaxed text-muted">
          Contact the VBS team if you need help completing payment.
        </p>
      ) : null}

      {message ? (
        <p
          className={
            error
              ? "text-sm text-red-800 dark:text-red-200"
              : "text-sm text-emerald-800 dark:text-emerald-200"
          }
        >
          {message}
        </p>
      ) : null}
    </section>
  );
}
