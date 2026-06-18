"use server";

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma";
import {
  ensureRegistrationFormForSeason,
  isFormRegistrationOpen,
} from "@/lib/ensure-registration-form";
import { parseFormDefinitionJson } from "@/lib/registration-form-definition";
import { parseDynamicRegistrationForm } from "@/lib/registration-form-validate";
import { rulesFromDb } from "@/lib/public-registration";
import {
  sendSubmissionPendingReviewEmail,
  sendSubmissionReceivedEmail,
} from "@/lib/email/registration-emails";
import {
  applyAutoAssignmentToRegistration,
  fetchClassroomsForAutoAssign,
  resolveAutoClassAssignment,
} from "@/lib/class-assignment";
import { tryAutoApproveRegistrationsForSubmission } from "@/lib/auto-approve-registration";
import {
  formatParticipantAgeAsOfLabel,
  parseParticipantCalendarDate,
  resolveParticipantAgeRules,
  validateParticipantAge,
} from "@/lib/participant-age-gate";
import {
  computeProcessingGrossUp,
  computeRegistrationBaseCents,
  includeProcessingFeeForMode,
} from "@/lib/stripe-fee-math";
import { shouldSkipStripeForSubmission } from "@/lib/stripe-skip-rule";
import { createRegistrationStripeCheckoutSession } from "@/lib/stripe-registration-payment";
import { resolveWaiverDisplayContent } from "@/lib/default-waiver-content";
import { makeCheckInToken, makeUniqueRegistrationNumber } from "@/lib/registration-identity";
import {
  buildSupplementalPdfRows,
  buildWaiverMergeRows,
  filterWaiverMergeKeysToDef,
  parseWaiverMergeFieldKeysFromDb,
  parseWaiverPerChildPayload,
  parseWaiverSupplementalDefsFromDb,
  type WaiverPerChildSubmit,
} from "@/lib/waiver-merge-fields";
import { renderWaiverPdfBuffer, storeWaiverPdf } from "@/lib/waiver-pdf";
import { resolvePayLaterNotice } from "@/lib/pay-later";
import {
  formatClassPlacementBlockMessage,
  resolveRegistrationHelpContact,
  shouldBlockRegistrationWithoutClassPlacement,
  type ClassPlacementChildInput,
} from "@/lib/class-placement-gate";
import { previewClassPlacementForChildren } from "@/lib/preview-class-placement";

export type PublicRegisterState = {
  ok: boolean;
  message: string;
  fieldErrors?: Record<string, string[]>;
  registrationCode?: string;
  /** When set, the browser should redirect to Stripe Checkout (HTTPS). */
  stripeCheckoutUrl?: string;
  /**
   * Stripe was configured but checkout was skipped by the form’s conditional rule;
   * the client may show team-review follow-up copy on the thank-you screen.
   */
  paymentSkippedAwaitingTeamReview?: boolean;
  /** Family chose pay later; show {@link payLaterNotice} on the thank-you screen. */
  payLaterSubmitted?: boolean;
  payLaterNotice?: string;
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

async function createRegistrationWithIdentity(
  tx: Prisma.TransactionClient,
  args: {
    childId: string;
    seasonId: string;
    seasonYear: number;
    status: "PENDING" | "WAITLIST";
    formSubmissionId: string;
    customResponses?: object;
    notes: string;
    expectsPayment: boolean;
  },
) {
  for (let i = 0; i < 8; i++) {
    const registrationNumber = await makeUniqueRegistrationNumber(
      { seasonId: args.seasonId, seasonYear: args.seasonYear },
      tx,
    );
    const checkInToken = makeCheckInToken();
    try {
      return await tx.registration.create({
        data: {
          childId: args.childId,
          seasonId: args.seasonId,
          status: args.status,
          formSubmissionId: args.formSubmissionId,
          customResponses: args.customResponses,
          notes: args.notes,
          expectsPayment: args.expectsPayment,
          registrationNumber,
          checkInToken,
        },
      });
    } catch (e: unknown) {
      const code =
        e && typeof e === "object" && "code" in e
          ? String((e as { code: unknown }).code)
          : "";
      if (code === "P2002" && i < 7) continue;
      throw e;
    }
  }
  throw new Error("Could not allocate registration identity.");
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
    return { ok: false, message: "Choose a valid program." };
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

  const supplementalDefs = parseWaiverSupplementalDefsFromDb(formRow.waiverSupplementalFields);
  const mergeKeys = filterWaiverMergeKeysToDef(def, parseWaiverMergeFieldKeysFromDb(formRow.waiverMergeFieldKeys));

  let waiverPerChild: WaiverPerChildSubmit[] | null = null;
  if (formRow.waiverEnabled) {
    const wRaw = fdGet("waiverPerChildJson", formData).trim();
    const wParsed = parseWaiverPerChildPayload(wRaw, data.children.length, supplementalDefs);
    if (!wParsed.ok) return { ok: false, message: wParsed.message };
    waiverPerChild = wParsed.value;
  }

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
      dobDates.push(parseParticipantCalendarDate(c.childDateOfBirth));
    }
  } catch {
    return {
      ok: false,
      message: "Invalid date of birth for one or more children.",
    };
  }

  const ageRules = resolveParticipantAgeRules({
    minimumParticipantAgeYears: formRow.minimumParticipantAgeYears,
    maximumParticipantAgeYears: formRow.maximumParticipantAgeYears,
    participantAgeAsOfDate: season.participantAgeAsOfDate,
    seasonStartDate: season.startDate,
  });
  const participantLabel = "Participant";

  for (let i = 0; i < dobDates.length; i++) {
    const msg = validateParticipantAge(dobDates[i], ageRules, participantLabel, i);
    if (msg) {
      const cutoffLabel = formatParticipantAgeAsOfLabel(ageRules.asOfDate);
      return {
        ok: false,
        message: msg,
        fieldErrors: {
          [`childDateOfBirth__${i}`]: [
            msg.includes("at least")
              ? `Must be at least ${ageRules.minimumYears} years old as of ${cutoffLabel} (whole years).`
              : `Must be at most ${ageRules.maximumYears} years old as of ${cutoffLabel} (whole years).`,
          ],
        },
      };
    }
  }

  const classPlacementMsg = await assertClassPlacementAllowed({
    season,
    formRow,
    children: data.children.map((c) => ({
      childFirstName: c.childFirstName,
      childLastName: c.childLastName,
      childDateOfBirth: c.childDateOfBirth,
      custom: c.custom,
    })),
  });
  if (classPlacementMsg) {
    return { ok: false, message: classPlacementMsg };
  }

  const confirmation =
    formRow.confirmationMessage?.trim() ||
    "Thank you — your registration was received. The church office may follow up to confirm details.";

  const stripeConfigActive =
    formRow.stripeCheckoutEnabled && (formRow.stripeAmountCents ?? 0) >= 50;
  const stripePaymentSkippedByRule = shouldSkipStripeForSubmission({
    skipFieldKey: formRow.stripeSkipWhenFieldKey,
    skipFieldValue: formRow.stripeSkipWhenFieldValue,
    guardian: data.guardian,
    guardianCustom: data.guardianCustom,
    children: data.children,
  });
  const payLaterAllowed =
    stripeConfigActive && !stripePaymentSkippedByRule && formRow.stripePayLaterEnabled;
  const paymentChoice = fdGet("paymentChoice", formData).trim();
  const payLaterChosen = payLaterAllowed && paymentChoice === "pay_later";
  if (payLaterAllowed && paymentChoice && paymentChoice !== "card" && paymentChoice !== "pay_later") {
    return { ok: false, message: "Invalid payment choice. Please try again." };
  }
  if (paymentChoice === "pay_later" && !payLaterAllowed) {
    return { ok: false, message: "Pay later is not available for this form." };
  }

  const stripeCheckoutRequired =
    stripeConfigActive && !stripePaymentSkippedByRule && !payLaterChosen;
  if (stripeCheckoutRequired && !process.env.STRIPE_SECRET_KEY?.trim()) {
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
    formRow.stripeCapPaidChildrenAtThree,
  );
  const totalEarly = computeProcessingGrossUp(baseEarly, includeFeeEarly).totalCents;
  if (stripeCheckoutRequired && totalEarly < 50) {
    return {
      ok: false,
      message:
        "The configured fee is too small for card checkout (minimum about US$0.50). Please contact the church office.",
    };
  }

  type TxOutcome =
    | { kind: "replay"; registrationCode: string; waitlist: boolean; childCount: number }
    | {
        kind: "new";
        submissionId: string;
        registrationCode: string;
        waitlist: boolean;
        childCount: number;
        stripePaymentSkippedByRule: boolean;
        payLaterChosen: boolean;
        registrationIds: string[];
      };

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
          payLaterChosen,
          guardianResponses: {
            ...(data.guardianCustom as Record<string, unknown>),
            smsConsentForEventUpdates: smsConsent,
          },
          formVersion: formRow.publishedVersion,
        },
      });

      const registeredAt = new Date();
      const classrooms = season.classroomsEnabled
        ? await fetchClassroomsForAutoAssign(tx, seasonId)
        : [];

      const registrationIds: string[] = [];
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

        const reg = await createRegistrationWithIdentity(tx, {
          childId: child.id,
          seasonId,
          seasonYear: season.year,
          status,
          formSubmissionId: submission.id,
          customResponses: Object.keys(c.custom).length ? (c.custom as object) : undefined,
          notes: baseNotes,
          expectsPayment: stripeConfigActive && !stripePaymentSkippedByRule,
        });
        registrationIds.push(reg.id);

        const childFieldContext: Record<string, string | boolean | number | null> = {
          ...c.custom,
          childFirstName: c.childFirstName,
          childLastName: c.childLastName,
          childDateOfBirth: c.childDateOfBirth,
          allergiesNotes: c.allergiesNotes ?? null,
        };
        const assignResult = season.classroomsEnabled
          ? await resolveAutoClassAssignment(tx, {
              childDob: dobDates[i],
              registeredAt,
              seasonStartDate: season.startDate,
              currentStatus: status,
              classrooms,
              childFieldContext,
            })
          : null;
        if (assignResult) {
          await applyAutoAssignmentToRegistration(tx, {
            registrationId: reg.id,
            result: assignResult,
            existingNotes: baseNotes,
          });
        }
      }

      return {
        kind: "new" as const,
        submissionId: submission.id,
        registrationCode,
        waitlist,
        childCount: data.children.length,
        stripePaymentSkippedByRule,
        payLaterChosen,
        registrationIds,
      };
    },
      { maxWait: 20_000, timeout: 60_000 },
    );

    if (outcome.kind === "new") {
      if (formRow.waiverEnabled && waiverPerChild && outcome.registrationIds.length === data.children.length) {
        try {
          for (let i = 0; i < data.children.length; i++) {
            const c = data.children[i];
            const w = waiverPerChild[i];
            const primaryChildName = `${c.childFirstName} ${c.childLastName}`.trim();
            const mergeRows = buildWaiverMergeRows(def, mergeKeys, data.guardian, data.guardianCustom, c);
            const supplementalRows = buildSupplementalPdfRows(supplementalDefs, w.supplemental);
            const capturedFieldsJson = {
              primaryChildName,
              mergeRows,
              supplemental: w.supplemental ?? {},
              mergeKeysUsed: mergeKeys,
            };
            const waiverCopy = resolveWaiverDisplayContent({
              title: formRow.waiverTitle,
              description: formRow.waiverDescription,
              body: formRow.waiverBody,
            });
            const pdfBuffer = await renderWaiverPdfBuffer({
              title: waiverCopy.title,
              description: waiverCopy.description,
              body: waiverCopy.body,
              seasonName: season.name,
              primaryChildName,
              mergeRows,
              supplementalRows,
              signerName: w.signerName,
              signedAtIso: w.signedAtIso,
              signatureDataUrl: w.signatureDataUrl,
            });
            const pdfUrl = await storeWaiverPdf(pdfBuffer, seasonId, outcome.registrationIds[i]!);
            await prisma.waiverAgreement.create({
              data: {
                registrationId: outcome.registrationIds[i]!,
                seasonId,
                signerName: w.signerName,
                signedAt: new Date(w.signedAtIso),
                signatureDataUrl: w.signatureDataUrl,
                pdfUrl,
                capturedFieldsJson,
              },
            });
          }
        } catch (err) {
          console.error("[waiver pdf save]", err);
          return {
            ok: false,
            message: "We could not save the waiver document. Please try again.",
          };
        }
      }

      if (
        stripeCheckoutRequired &&
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
          formRow.stripeCapPaidChildrenAtThree,
        );
        const { totalCents, processingCents } = computeProcessingGrossUp(baseCents, includeFee);

        const productLabel =
          formRow.stripeProductLabel?.trim() || `${season.name} — VBS registration`;

        const checkout = await createRegistrationStripeCheckoutSession({
          formSubmissionId: outcome.submissionId,
          seasonId,
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
          message: "Click continue to open secure card payment.",
          registrationCode: outcome.registrationCode,
          stripeCheckoutUrl: checkout.url,
        };
      }

      if (outcome.stripePaymentSkippedByRule) {
        void sendSubmissionPendingReviewEmail(outcome.submissionId).catch((err) => {
          console.error("[sendSubmissionPendingReviewEmail]", err);
        });
      } else if (outcome.payLaterChosen || !stripeCheckoutRequired) {
        void sendSubmissionReceivedEmail(outcome.submissionId).catch((err) => {
          console.error("[sendSubmissionReceivedEmail]", err);
        });
      }

      void tryAutoApproveRegistrationsForSubmission(outcome.submissionId).catch((err) => {
        console.error("[tryAutoApproveRegistrationsForSubmission]", err);
      });
    }

    const payLaterNotice =
      outcome.kind === "new" && outcome.payLaterChosen
        ? resolvePayLaterNotice(season, formRow.stripePayLaterMessage)
        : undefined;

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
      paymentSkippedAwaitingTeamReview:
        stripeConfigActive && stripePaymentSkippedByRule ? true : undefined,
      payLaterSubmitted: outcome.kind === "new" && outcome.payLaterChosen ? true : undefined,
      payLaterNotice,
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

async function assertClassPlacementAllowed(args: {
  season: {
    id: string;
    classroomsEnabled: boolean;
    publicRegistrationSettings: {
      helpContactEmail: string | null;
      helpContactPhone: string | null;
    } | null;
  };
  formRow: { waitlistEnabled: boolean };
  children: ClassPlacementChildInput[];
}): Promise<string | null> {
  if (
    !shouldBlockRegistrationWithoutClassPlacement({
      classroomsEnabled: args.season.classroomsEnabled,
      waitlistEnabled: args.formRow.waitlistEnabled,
    })
  ) {
    return null;
  }

  const rows = await previewClassPlacementForChildren(prisma, {
    seasonId: args.season.id,
    children: args.children,
  });
  const unplaced = rows.filter((r) => !r.canPlace);
  if (unplaced.length === 0) return null;

  const helpContact = resolveRegistrationHelpContact({
    helpContactEmail: args.season.publicRegistrationSettings?.helpContactEmail,
    contactPhone: args.season.publicRegistrationSettings?.helpContactPhone,
  });
  return formatClassPlacementBlockMessage({ unplaced, helpContact });
}
