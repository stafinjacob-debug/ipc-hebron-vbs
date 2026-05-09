import type { StripePricingUnit, StripeProcessingFeeMode } from "@/generated/prisma";

/** Typical US card pricing — gross-up so net to church ≈ base after Stripe fees. */
const CARD_FEE_RATE = 0.029;
const CARD_FEE_FIXED_CENTS = 30;

/** Max children counted toward the base fee when {@link computeRegistrationBaseCents} uses the family cap. */
export const STRIPE_PER_CHILD_MAX_PAID_COUNT = 3;

export function computeRegistrationBaseCents(
  unit: StripePricingUnit,
  amountPerUnitCents: number | null | undefined,
  childCount: number,
  capPaidChildrenAtThree = false,
): number {
  const per = amountPerUnitCents ?? 0;
  if (per <= 0) return 0;
  const n = Math.max(1, childCount);
  if (unit === "PER_CHILD") {
    const billable = capPaidChildrenAtThree ? Math.min(n, STRIPE_PER_CHILD_MAX_PAID_COUNT) : n;
    return Math.round(per * billable);
  }
  return per;
}

export function computeProcessingGrossUp(
  baseCents: number,
  includeProcessingFee: boolean,
): { totalCents: number; processingCents: number } {
  if (!includeProcessingFee || baseCents <= 0) {
    return { totalCents: baseCents, processingCents: 0 };
  }
  const totalCents = Math.ceil((baseCents + CARD_FEE_FIXED_CENTS) / (1 - CARD_FEE_RATE));
  return { totalCents, processingCents: totalCents - baseCents };
}

export function includeProcessingFeeForMode(
  mode: StripeProcessingFeeMode,
  payerOptedIn: boolean,
): boolean {
  if (mode === "REQUIRED") return true;
  return payerOptedIn;
}

export function formatUsdFromCents(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}
