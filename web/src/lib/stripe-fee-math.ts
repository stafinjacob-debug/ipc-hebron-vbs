import type { StripePricingUnit, StripeProcessingFeeMode } from "@/generated/prisma";

/** Typical US card pricing — gross-up so net to church ≈ base after Stripe fees. */
const CARD_FEE_RATE = 0.029;
const CARD_FEE_FIXED_CENTS = 30;

export function computeRegistrationBaseCents(
  unit: StripePricingUnit,
  amountPerUnitCents: number | null | undefined,
  childCount: number,
): number {
  const per = amountPerUnitCents ?? 0;
  if (per <= 0) return 0;
  const n = Math.max(1, childCount);
  return unit === "PER_CHILD" ? Math.round(per * n) : per;
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
