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

export function registrationListPaymentBadge(r: RegistrationPaymentBadgeInput): {
  label: string;
  className: string;
} {
  if (r.paymentReceivedAt) {
    return {
      label: "Paid",
      className:
        "inline-flex rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-800 dark:text-emerald-300",
    };
  }
  const stripeStatus = (r.formSubmission?.stripePaymentStatus ?? "").toLowerCase();
  if (stripeStatus === "paid") {
    return {
      label: "Paid",
      className:
        "inline-flex rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-800 dark:text-emerald-300",
    };
  }
  if (r.expectsPayment) {
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
    return {
      label: "Due",
      className:
        "inline-flex rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-medium text-amber-900 dark:text-amber-200",
    };
  }
  return { label: "Not required", className: "text-xs text-foreground/55" };
}

/** `payment` query param → Prisma `where` fragment (merged with AND). */
export function mergeRegistrationPaymentStatusFilter(
  where: Prisma.RegistrationWhereInput,
  payment: string,
): void {
  const p = payment.trim();
  if (!p) return;

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

  switch (p) {
    case "paid":
      mergeWhereAnd(where, paidClause);
      break;
    case "due":
      // Legacy + clearest name: still expecting payment, nothing recorded as received.
      mergeWhereAnd(where, { expectsPayment: true, paymentReceivedAt: null });
      break;
    case "not_required":
      mergeWhereAnd(where, {
        expectsPayment: false,
        paymentReceivedAt: null,
        NOT: {
          formSubmission: {
            is: { stripePaymentStatus: { equals: "paid", mode: "insensitive" } },
          },
        },
      });
      break;
    case "checkout_pending":
      mergeWhereAnd(where, {
        expectsPayment: true,
        paymentReceivedAt: null,
        formSubmission: {
          is: {
            stripePaymentStatus: { equals: "pending", mode: "insensitive" },
            stripeCheckoutSessionId: { not: null },
          },
        },
      });
      break;
    case "due_canceled":
      mergeWhereAnd(where, {
        expectsPayment: true,
        paymentReceivedAt: null,
        formSubmission: {
          is: { stripePaymentStatus: { equals: "canceled", mode: "insensitive" } },
        },
      });
      break;
    case "due_plain":
      mergeWhereAnd(where, {
        expectsPayment: true,
        paymentReceivedAt: null,
        AND: [
          {
            NOT: {
              formSubmission: {
                is: { stripePaymentStatus: { equals: "paid", mode: "insensitive" } },
              },
            },
          },
          {
            NOT: {
              formSubmission: {
                is: {
                  stripePaymentStatus: { equals: "pending", mode: "insensitive" },
                  stripeCheckoutSessionId: { not: null },
                },
              },
            },
          },
          {
            NOT: {
              formSubmission: {
                is: { stripePaymentStatus: { equals: "canceled", mode: "insensitive" } },
              },
            },
          },
        ],
      });
      break;
    default:
      break;
  }
}
