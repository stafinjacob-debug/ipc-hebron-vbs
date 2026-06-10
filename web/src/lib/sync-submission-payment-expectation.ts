import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { formatCalendarDateInputValue } from "@/lib/season-calendar-date";
import { shouldSkipStripeForSubmission } from "@/lib/stripe-skip-rule";

function customRecord(raw: unknown): Record<string, string | boolean | number | null> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, string | boolean | number | null> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (value === null || typeof value === "string" || typeof value === "boolean" || typeof value === "number") {
      out[key] = value;
      continue;
    }
    out[key] = String(value);
  }
  return out;
}

type StripeFormRow = {
  stripeCheckoutEnabled: boolean;
  stripeAmountCents: number | null;
  stripeSkipWhenFieldKey: string | null;
  stripeSkipWhenFieldValue: string | null;
};

/**
 * Recompute `expectsPayment` for all active registrations on a submission after
 * staff or family edits change answers that affect the Stripe skip rule.
 */
export async function syncSubmissionPaymentExpectation(
  submissionId: string,
  tx?: Prisma.TransactionClient,
): Promise<{ expectsPayment: boolean } | null> {
  const db = tx ?? prisma;

  const submission = await db.formSubmission.findUnique({
    where: { id: submissionId },
    include: {
      guardian: true,
      registrations: {
        where: { status: { not: "CANCELLED" } },
        include: { child: true },
      },
      form: {
        select: {
          stripeCheckoutEnabled: true,
          stripeAmountCents: true,
          stripeSkipWhenFieldKey: true,
          stripeSkipWhenFieldValue: true,
        },
      },
      season: {
        include: {
          registrationForm: {
            select: {
              stripeCheckoutEnabled: true,
              stripeAmountCents: true,
              stripeSkipWhenFieldKey: true,
              stripeSkipWhenFieldValue: true,
            },
          },
        },
      },
    },
  });
  if (!submission) return null;

  const formRow: StripeFormRow | null | undefined = submission.form ?? submission.season.registrationForm;
  if (!formRow) return null;

  const stripeConfigActive =
    formRow.stripeCheckoutEnabled && (formRow.stripeAmountCents ?? 0) >= 50;

  const guardianResponses = (submission.guardianResponses as Record<string, unknown> | null) ?? {};
  const paymentSkippedByRule = shouldSkipStripeForSubmission({
    skipFieldKey: formRow.stripeSkipWhenFieldKey,
    skipFieldValue: formRow.stripeSkipWhenFieldValue,
    guardian: {
      guardianFirstName: submission.guardian.firstName,
      guardianLastName: submission.guardian.lastName,
      guardianEmail: submission.guardian.email ?? undefined,
      guardianPhone: submission.guardian.phone ?? undefined,
    },
    guardianCustom: customRecord(guardianResponses),
    children: submission.registrations.map((reg) => ({
      childFirstName: reg.child.firstName,
      childLastName: reg.child.lastName,
      childDateOfBirth: formatCalendarDateInputValue(reg.child.dateOfBirth),
      allergiesNotes: reg.child.allergiesNotes,
      custom: customRecord(reg.customResponses),
    })),
  });

  const expectsPayment = stripeConfigActive && !paymentSkippedByRule;

  await db.registration.updateMany({
    where: {
      formSubmissionId: submissionId,
      status: { not: "CANCELLED" },
    },
    data: { expectsPayment },
  });

  return { expectsPayment };
}
