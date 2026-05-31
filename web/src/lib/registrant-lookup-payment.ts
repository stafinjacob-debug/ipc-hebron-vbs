import type { RegistrationPaymentBadgeInput } from "@/lib/registration-list-payment";
import {
  canPayRegistrationOnline,
  isCheckoutPendingRegistration,
  registrationListPaymentBadge,
} from "@/lib/registration-list-payment";
import { formatUsdFromCents } from "@/lib/stripe-fee-math";

export type RegistrantPaymentDisplay = {
  label: string;
  className: string;
  canPayOnline: boolean;
  checkoutPending: boolean;
  amountDueLabel: string | null;
  stripeConfigured: boolean;
};

export function buildRegistrantPaymentDisplay(args: {
  payment: RegistrationPaymentBadgeInput & { formSubmissionId: string | null };
  stripeAmountChargedCents: number | null;
  stripeConfigured: boolean;
}): RegistrantPaymentDisplay {
  const badge = registrationListPaymentBadge(args.payment);
  const canPayOnline = canPayRegistrationOnline(args.payment);
  const checkoutPending = isCheckoutPendingRegistration(args.payment);
  const amountDueLabel =
    args.payment.expectsPayment &&
    !badge.label.startsWith("Paid") &&
    args.stripeAmountChargedCents != null &&
    args.stripeAmountChargedCents >= 50
      ? formatUsdFromCents(args.stripeAmountChargedCents)
      : null;

  return {
    label: badge.label,
    className: badge.className,
    canPayOnline,
    checkoutPending,
    amountDueLabel,
    stripeConfigured: args.stripeConfigured,
  };
}
