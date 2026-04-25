"use server";

import { prisma } from "@/lib/prisma";
import {
  ensureRegistrationFormForSeason,
  isFormRegistrationOpen,
} from "@/lib/ensure-registration-form";
import { parseFormDefinitionJson } from "@/lib/registration-form-definition";
import { parseDynamicRegistrationForm } from "@/lib/registration-form-validate";
import { rulesFromDb } from "@/lib/public-registration";
import { sendSubmissionReceivedEmail } from "@/lib/email/registration-emails";
import {
  applyAutoAssignmentToRegistration,
  fetchClassroomsForAutoAssign,
  resolveAutoClassAssignment,
} from "@/lib/class-assignment";
import { childAgeYearsOnDate } from "@/lib/class-assignment-shared";
import { parseLocalDate } from "@/lib/schemas/vbs-registration";
import {
  computeProcessingGrossUp,
  computeRegistrationBaseCents,
  includeProcessingFeeForMode,
} from "@/lib/stripe-fee-math";
import { createRegistrationStripeCheckoutSession } from "@/lib/stripe-registration-payment";

export type PublicRegisterState = {
  ok: boolean;
  message: string;
  fieldErrors?: Record<string, string[]>;
  registrationCode?: string;
  /** When set, the browser should redirect to Stripe Checkout (HTTPS). */
  stripeCheckoutUrl?: string;
};

function fdGet(k: string, formData: FormData): string {
  const v = formData.get(k);
  return typeof v === "string" ? v : "";
}

function makeRegistrationCode(): string {
  const a = Date.now().toString(36).toUpperCase();
  const b = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `VBS-${a}-${b}`;
}

/** Browser `crypto.randomUUID()` (v4). */
const CLIENT_SUBMIT_KEY_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
/** Fallback from `public-registration-form` when `crypto.randomUUID` is unavailable. */
const CLIENT_SUBMIT_KEY_FALLBACK_RE = /^idem-\d+-[a-z0-9]{6,32}$/i;

/** Namespace for `pg_advisory_xact_lock(int, int)` (VBS public registration). */
const ADV_LOCK_SPACE = 5_829_413;

/**
 * Reserved form field (dynamic wizard) so the nonce never collides with a builder field key.
 * Legacy: `clientSubmitKey` on public-registration-form.
 */
function resolveClientSubmitKey(formData: FormData): string {
  return fdGet("__vbsSubmitNonce", formData).trim() || fdGet("clientSubmitKey", formData).trim();
}

async function submitPublicRegistrationImpl(
  _prev: PublicRegisterState | null,
  formData: FormData,
): Promise<PublicRegisterState> {
  try {
    return await submitPublicRegistrationCore(_prev, formData);
  } catch (e) {
    console.error("[submitPublicRegistration]", e);
    return {
      ok: false,
      message: "Something went wrong. Please try again in a few minutes.",
    };
  }
}

async function submitPublicRegistrationCore(
  _prev: PublicRegisterState | null,
  formData: FormData,
): Promise<PublicRegisterState> {
  const seasonId = fdGet("seasonId", formData);

  const season = await prisma.vbsSeason.findUnique({
    where: { id: seasonId },
    include: { publicRegistrationSettings: true, registrationForm: true },
  });

  if (!season) {
    return { ok: false, message: "Choose a valid VBS season." };
  }
  if (!season.publicRegistrationOpen) {
    return {
      ok: false,
      message: "Online registration is closed for this season.",
    };
  }

  const formRow =
    season.registrationForm ??
    (await ensureRegistrationFormForSeason(season.id, season.name));

  if (formRow.status !== "PUBLISHED") {
    return { ok: false, message: "Registration is not available for this season right now." };
  }

  if (!isFormRegistrationOpen(formRow)) {
    return { ok: false, message: "Registration is not open during this date range." };
  }

  const def = parseFormDefinitionJson(formRow.publishedDefinitionJson);
  if (!def) {
    return { ok: false, message: "This registration form is not configured correctly. Please contact the church." };
  }

  const rules = rulesFromDb(season.publicRegistrationSettings);

  if (fdGet("company", formData).trim() !== "") {
    return { ok: false, message: "Unable to submit this form." };
  }

  if (fdGet("confirmedAccurate", formData) !== "true") {
    return {
      ok: false,
      message: "Please confirm your information is accurate before submitting.",
      fieldErrors: { confirmedAccurate: ["Required"] },
    };
  }

  const smsConsent = fdGet("smsConsent", formData) === "true";

  const parsed = parseDynamicRegistrationForm(formData, def, rules);
  if (!parsed.ok) {
    return {
      ok: false,
      message: parsed.message,
      fieldErrors: parsed.fieldKey ? { [parsed.fieldKey]: [parsed.message] } : undefined,
    };
  }

  const data = parsed;
  if (smsConsent && !data.guardian.guardianPhone?.trim()) {
    return {
      ok: false,
      message: "Please provide a phone number to receive SMS updates.",
      fieldErrors: { guardianPhone: ["Phone required for SMS consent"] },
    };
  }

  const clientSubmitKey = resolveClientSubmitKey(formData);
  if (
    clientSubmitKey.length > 80 ||
    (!CLIENT_SUBMIT_KEY_RE.test(clientSubmitKey) &&
      !CLIENT_SUBMIT_KEY_FALLBACK_RE.test(clientSubmitKey))
  ) {
    return {
      ok: false,
      message: "This page is out of date. Please refresh and submit again.",
    };
  }

  const dobDates: Date[] = [];
  try {
    for (const c of data.children) {
      dobDates.push(parseLocalDate(c.childDateOfBirth));
    }
  } catch {
    return {
      ok: false,
      message: "Invalid date of birth for one or more children.",
    };
  }

  const minYears = formRow.minimumParticipantAgeYears;
  const maxYears = formRow.maximumParticipantAgeYears;
  if (
    (minYears != null && minYears >= 1) ||
    (maxYears != null && maxYears >= 1)
  ) {
    const asOf = season.startDate;
    const startLabel = asOf.toLocaleDateString(undefined, {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    for (let i = 0; i < dobDates.length; i++) {
      const age = childAgeYearsOnDate(dobDates[i], asOf);
      if (minYears != null && minYears >= 1 && age < minYears) {
        return {
          ok: false,
          message: `Child ${i + 1} must be at least ${minYears} years old on the first day of VBS (${startLabel}).`,
          fieldErrors: {
            [`childDateOfBirth__${i}`]: [
              `Children must be at least ${minYears} on the program start date (${startLabel}).`,
            ],
          },
        };
      }
      if (maxYears != null && maxYears >= 1 && age > maxYears) {
        return {
          ok: false,
          message: `Child ${i + 1} must be at most ${maxYears} years old on the first day of VBS (${startLabel}).`,
          fieldErrors: {
            [`childDateOfBirth__${i}`]: [
              `Children must be at most ${maxYears} on the program start date (${startLabel}).`,
            ],
          },
        };
      }
    }
  }

  const confirmation =
    formRow.confirmationMessage?.trim() ||
    "Thank you — your registration was received. The church office may follow up to confirm details.";

  const stripeConfigActive =
    formRow.stripeCheckoutEnabled && (formRow.stripeAmountCents ?? 0) >= 50;
  if (stripeConfigActive && !process.env.STRIPE_SECRET_KEY?.trim()) {
    return {
      ok: false,
      message:
        "This form requires online payment, but the payment system is not configured. Please contact the church office.",
    };
  }

  const payerFeeOptInEarly =
    fdGet("stripeCoverProcessingFee", formData) === "true" ||
    fdGet("stripeCoverProcessingFee", formData) === "on";
  const includeFeeEarly = includeProcessingFeeForMode(formRow.stripeProcessingFeeMode, payerFeeOptInEarly);
  const baseEarly = computeRegistrationBaseCents(
    formRow.stripePricingUnit,
    formRow.stripeAmountCents,
    data.children.length,
  );
  const totalEarly = computeProcessingGrossUp(baseEarly, includeFeeEarly).totalCents;
  if (stripeConfigActive && totalEarly < 50) {
    return {
      ok: false,
      message:
        "The configured fee is too small for card checkout (minimum about US$0.50). Please contact the church office.",
    };
  }

  type TxOutcome =
    | { kind: "replay"; registrationCode: string; waitlist: boolean; childCount: number }
    | { kind: "new"; submissionId: string; registrationCode: string; waitlist: boolean; childCount: number };

  let outcome: TxOutcome;
  try {
    outcome = await prisma.$transaction(
      async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${ADV_LOCK_SPACE}, hashtext(${seasonId}::text))`;

      const prior = await tx.formSubmission.findFirst({
        where: { clientSubmitKey, seasonId },
        select: {
          id: true,
          registrationCode: true,
          registrations: { select: { status: true } },
        },
      });
      if (prior) {
        const childCount = prior.registrations.length;
        const waitlist =
          childCount > 0 && prior.registrations.every((r) => r.status === "WAITLIST");
        return {
          kind: "replay" as const,
          registrationCode: prior.registrationCode,
          waitlist,
          childCount,
        };
      }

      let waitlist = false;
      if (formRow.maxTotalRegistrations != null && formRow.maxTotalRegistrations > 0) {
        const current = await tx.registration.count({
          where: {
            seasonId,
            status: { notIn: ["CANCELLED"] },
          },
        });
        if (current + data.children.length > formRow.maxTotalRegistrations) {
          if (!formRow.waitlistEnabled) {
            throw Object.assign(new Error("CAPACITY_FULL"), { code: "CAPACITY_FULL" });
          }
          waitlist = true;
        }
      }

      const registrationCode = makeRegistrationCode();

      const guardian = await tx.guardian.create({
        data: {
          firstName: data.guardian.guardianFirstName,
          lastName: data.guardian.guardianLastName,
          email: data.guardian.guardianEmail?.trim() ? data.guardian.guardianEmail.trim() : null,
          phone: data.guardian.guardianPhone?.trim() ? data.guardian.guardianPhone.trim() : null,
        },
      });

      const submission = await tx.formSubmission.create({
        data: {
          registrationCode,
          seasonId,
          formId: formRow.id,
          guardianId: guardian.id,
          clientSubmitKey,
          guardianResponses: {
            ...(data.guardianCustom as Record<string, unknown>),
            smsConsentForEventUpdates: smsConsent,
          },
          formVersion: formRow.publishedVersion,
        },
      });

      const registeredAt = new Date();
      const classrooms = await fetchClassroomsForAutoAssign(tx, seasonId);

      for (let i = 0; i < data.children.length; i++) {
        const c = data.children[i];
        const child = await tx.child.create({
          data: {
            firstName: c.childFirstName,
            lastName: c.childLastName,
            dateOfBirth: dobDates[i],
            allergiesNotes: c.allergiesNotes,
            guardianId: guardian.id,
          },
        });

        const status = waitlist ? "WAITLIST" : "PENDING";

        const baseNotes =
          data.children.length > 1
            ? `Public registration (${i + 1} of ${data.children.length}) · Code ${registrationCode}`
            : `Public registration · Code ${registrationCode}`;

        const reg = await tx.registration.create({
          data: {
            childId: child.id,
            seasonId,
            status,
            formSubmissionId: submission.id,
            customResponses: Object.keys(c.custom).length ? (c.custom as object) : undefined,
            notes: baseNotes,
            expectsPayment: stripeConfigActive,
          },
        });

        const childFieldContext: Record<string, string | boolean | number | null> = {
          ...c.custom,
          childFirstName: c.childFirstName,
          childLastName: c.childLastName,
          childDateOfBirth: c.childDateOfBirth,
          allergiesNotes: c.allergiesNotes ?? null,
        };
        const assignResult = await resolveAutoClassAssignment(tx, {
          childDob: dobDates[i],
          registeredAt,
          seasonStartDate: season.startDate,
          currentStatus: status,
          classrooms,
          childFieldContext,
        });
        await applyAutoAssignmentToRegistration(tx, {
          registrationId: reg.id,
          result: assignResult,
          existingNotes: baseNotes,
        });
      }

      return {
        kind: "new" as const,
        submissionId: submission.id,
        registrationCode,
        waitlist,
        childCount: data.children.length,
      };
    },
      { maxWait: 20_000, timeout: 60_000 },
    );

    if (outcome.kind === "new") {
      if (
        stripeConfigActive &&
        outcome.submissionId &&
        outcome.registrationCode &&
        outcome.childCount > 0
      ) {
        const payerOptIn =
          fdGet("stripeCoverProcessingFee", formData) === "true" ||
          fdGet("stripeCoverProcessingFee", formData) === "on";
        const includeFee = includeProcessingFeeForMode(formRow.stripeProcessingFeeMode, payerOptIn);
        const baseCents = computeRegistrationBaseCents(
          formRow.stripePricingUnit,
          formRow.stripeAmountCents,
          outcome.childCount,
        );
        const { totalCents, processingCents } = computeProcessingGrossUp(baseCents, includeFee);

        const productLabel =
          formRow.stripeProductLabel?.trim() || `${season.name} — VBS registration`;

        const checkout = await createRegistrationStripeCheckoutSession({
          formSubmissionId: outcome.submissionId,
          seasonId,
          registrationCode: outcome.registrationCode,
          productLabel,
          guardianEmail: data.guardian.guardianEmail?.trim() || null,
          baseCents,
          totalCents,
          processingCents,
          coverProcessingFee: includeFee,
        });

        if ("error" in checkout) {
          return {
            ok: false,
            message: `${checkout.error} Your reference code is ${outcome.registrationCode}. Please contact the church office to complete payment.`,
          };
        }

        return {
          ok: true,
          message: "Redirecting to secure card payment…",
          registrationCode: outcome.registrationCode,
          stripeCheckoutUrl: checkout.url,
        };
      }

      void sendSubmissionReceivedEmail(outcome.submissionId).catch((err) => {
        console.error("[sendSubmissionReceivedEmail]", err);
      });
    }

    const count = outcome.childCount;
    const base =
      count === 1
        ? confirmation
        : `${confirmation} (${count} children on one submission.)`;
    const wl = outcome.waitlist ? " You have been added to the waitlist." : "";
    const dupNote =
      outcome.kind === "replay"
        ? " (We received this submission already — your reference code is unchanged.)"
        : "";

    return {
      ok: true,
      message: `${base}${wl}${dupNote}`,
      registrationCode: outcome.registrationCode,
    };
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "CAPACITY_FULL") {
      return {
        ok: false,
        message:
          "This session is full. Please contact the church to join a waitlist or try another option.",
      };
    }
    const code =
      e && typeof e === "object" && "code" in e
        ? String((e as { code: unknown }).code)
        : "";
    if (code === "P2002") {
      return {
        ok: false,
        message:
          "We already have a registration that matches one of these children for this season. Contact the church office if you need help.",
      };
    }
    console.error(e);
    return {
      ok: false,
      message: "Something went wrong. Please try again in a few minutes.",
    };
  }
}

export async function submitPublicRegistration(
  _prev: PublicRegisterState | null,
  formData: FormData,
): Promise<PublicRegisterState> {
  return submitPublicRegistrationImpl(_prev, formData);
}
