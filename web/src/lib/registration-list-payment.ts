import type { Prisma } from "@/generated/prisma";

function mergeWhereAnd(where: Prisma.RegistrationWhereInput, clause: Prisma.RegistrationWhereInput) {
  const prev = where.AND;
  const arr = Array.isArray(prev) ? [...prev] : prev ? [prev] : [];
  arr.push(clause);
  where.AND = arr;
}

export type RegistrationPaymentBadgeInput = {
  paymentReceivedAt: Date | null;
  expectsPayment: boolean;
  formSubmission: {
    stripePaymentStatus: string | null;
    stripeCheckoutSessionId: string | null;
  } | null;
};

export function registrationPaymentIsComplete(r: RegistrationPaymentBadgeInput): boolean {
  if (r.expectsPayment) {
    return Boolean(r.paymentReceivedAt);
  }
  if (r.paymentReceivedAt) return true;
  const stripeStatus = (r.formSubmission?.stripePaymentStatus ?? "").toLowerCase();
  return stripeStatus === "paid";
}

export function isCheckoutPendingRegistration(r: RegistrationPaymentBadgeInput): boolean {
  if (registrationPaymentIsComplete(r)) return false;
  if (!r.expectsPayment) return false;
  const stripeStatus = (r.formSubmission?.stripePaymentStatus ?? "").toLowerCase();
  return stripeStatus === "pending" && Boolean(r.formSubmission?.stripeCheckoutSessionId);
}

export function canPayRegistrationOnline(
  r: RegistrationPaymentBadgeInput & { formSubmissionId: string | null },
): boolean {
  return Boolean(r.formSubmissionId) && r.expectsPayment && !registrationPaymentIsComplete(r);
}

export function registrationListPaymentBadge(r: RegistrationPaymentBadgeInput): {
  label: string;
  className: string;
} {
  const paidBadge = {
    label: "Paid",
    className:
      "inline-flex rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-800 dark:text-emerald-300",
  };
  const dueBadge = {
    label: "Due",
    className:
      "inline-flex rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-medium text-amber-900 dark:text-amber-200",
  };

  if (r.expectsPayment) {
    if (r.paymentReceivedAt) return paidBadge;
    const stripeStatus = (r.formSubmission?.stripePaymentStatus ?? "").toLowerCase();
    if (stripeStatus === "pending" && r.formSubmission?.stripeCheckoutSessionId) {
      return {
        label: "Checkout pending",
        className:
          "inline-flex rounded-full border border-sky-500/35 bg-sky-500/10 px-2.5 py-0.5 text-xs font-medium text-sky-900 dark:text-sky-100",
      };
    }
    if (stripeStatus === "canceled") {
      return {
        label: "Due (checkout canceled)",
        className:
          "inline-flex rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-medium text-amber-900 dark:text-amber-200",
      };
    }
    return dueBadge;
  }

  if (r.paymentReceivedAt) return paidBadge;
  const stripeStatus = (r.formSubmission?.stripePaymentStatus ?? "").toLowerCase();
  if (stripeStatus === "paid") return paidBadge;
  return { label: "Not required", className: "text-xs text-foreground/55" };
}

/** Registrations still expecting payment (matches Payment Due summary + list filter). */
export function registrationPaymentOutstandingWhere(): Prisma.RegistrationWhereInput {
  return {
    expectsPayment: true,
    paymentReceivedAt: null,
  };
}

/** True when the registration list would show Paid (manual mark or Stripe, fee not re-opened). */
export function registrationListShowsPaid(r: RegistrationPaymentBadgeInput): boolean {
  return registrationListPaymentBadge(r).label === "Paid";
}

const paidClause: Prisma.RegistrationWhereInput = {
  OR: [
    { paymentReceivedAt: { not: null } },
    {
      formSubmission: {
        is: { stripePaymentStatus: { equals: "paid", mode: "insensitive" } },
      },
    },
  ],
};

const checkoutPendingClause: Prisma.RegistrationWhereInput = {
  expectsPayment: true,
  paymentReceivedAt: null,
  formSubmission: {
    is: {
      stripePaymentStatus: { equals: "pending", mode: "insensitive" },
      stripeCheckoutSessionId: { not: null },
    },
  },
};

const dueCanceledClause: Prisma.RegistrationWhereInput = {
  expectsPayment: true,
  paymentReceivedAt: null,
  formSubmission: {
    is: { stripePaymentStatus: { equals: "canceled", mode: "insensitive" } },
  },
};

/** `payment` query param → Prisma `where` fragment (merged with AND). */
export function mergeRegistrationPaymentStatusFilter(
  where: Prisma.RegistrationWhereInput,
  payment: string,
): void {
  const p = payment.trim();
  if (!p) return;

  switch (p) {
    case "paid":
      mergeWhereAnd(where, paidClause);
      break;
    case "due":
    case "due_plain":
      mergeWhereAnd(where, registrationPaymentOutstandingWhere());
      break;
    case "not_required":
      mergeWhereAnd(where, {
        expectsPayment: false,
        AND: [{ NOT: paidClause }],
      });
      break;
    case "checkout_pending":
      mergeWhereAnd(where, checkoutPendingClause);
      break;
    case "due_canceled":
      mergeWhereAnd(where, dueCanceledClause);
      break;
    default:
      break;
  }
}
