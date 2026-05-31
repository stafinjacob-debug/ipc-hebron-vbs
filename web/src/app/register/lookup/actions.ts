"use server";

import { randomInt } from "crypto";
import { compare, hash } from "bcryptjs";
import { z } from "zod";
import { getEffectiveDefinition } from "@/lib/ensure-registration-form";
import { prisma } from "@/lib/prisma";
import { rulesFromDb } from "@/lib/public-registration";
import { persistSingleRegistrationFormEntries, persistSubmissionFormEntries } from "@/lib/persist-submission-form-entries";
import { parseRegistrantEditForm } from "@/lib/registrant-edit-form";
import { createDefaultFormDefinition } from "@/lib/registration-form-definition";
import { sendRegistrantLookupOtpEmail } from "@/lib/email/send-registrant-lookup-otp-email";
import { isMicrosoftGraphEmailConfigured } from "@/lib/email/microsoft-graph";
import {
  clearRegistrantLookupSessionCookie,
  readRegistrantLookupSession,
  setRegistrantLookupSessionCookie,
  type RegistrantLookupSession,
} from "@/lib/registrant-lookup-session";
import {
  normalizeRegistrantLookupEmail,
  maskRegistrantLookupEmail,
  normalizeRegistrantLookupPhone,
  registrantLookupRegistrationWhere,
  type RegistrantLookupEmailOption,
  type RegistrantLookupMethod,
  type RegistrantLookupPickItem,
} from "@/lib/registrant-lookup";
import {
  findRegistrationsForLookupEmail,
  emailMatchesPhoneForLookup,
  findEmailOptionsForPhoneLookup,
  resolveEmailForRegistrationNumberLookup,
} from "@/lib/registrant-lookup-resolve";
import {
  registrantLookupRegistrationInclude,
  registrationMatchesLookupEmail,
  submissionMatchesLookupEmail,
} from "@/lib/registrant-lookup-fields";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getPublicAppBaseUrl } from "@/lib/public-app-url";
import { canPayRegistrationOnline } from "@/lib/registration-list-payment";
import { resolveCheckoutResumeUrlForSubmission } from "@/lib/stripe-registration-payment";

export type RegistrantLookupActionState = {
  ok: boolean;
  message: string;
  step?: "verify" | "pick_submission" | "pick_email";
  email?: string;
  otpSentTo?: string;
  registrationCode?: string;
  lookupMethod?: RegistrantLookupMethod;
  phone?: string;
  submissions?: RegistrantLookupPickItem[];
  emailOptions?: RegistrantLookupEmailOption[];
  /** When set, the browser should redirect to Stripe Checkout. */
  stripeCheckoutUrl?: string;
};

const OTP_TTL_MIN = 15;
const OTP_SENDS_PER_HOUR = 6;
const MAX_OTP_ATTEMPTS = 8;
const BCRYPT_OTP_ROUNDS = 10;

const emailSchema = z.string().email();

function neutralMessage(): string {
  return "If we found a matching registration, we sent a 6-digit code to the email on file. It expires in 15 minutes.";
}

function otpSentMessage(maskedEmail: string): string {
  return `We sent a 6-digit verification code to ${maskedEmail}. It expires in ${OTP_TTL_MIN} minutes.`;
}

function parseLookupMethod(raw: string): RegistrantLookupMethod {
  if (raw === "registration_number" || raw === "phone") return raw;
  return "email";
}

async function sendOtpToEmail(args: {
  emailNormalized: string;
  registrationCode?: string;
}): Promise<
  | { ok: true; otpSentTo: string }
  | { ok: false; message: string }
  | { ok: true; throttled: true }
> {
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentSends = await prisma.registrantLookupOtp.count({
    where: { emailNormalized: args.emailNormalized, createdAt: { gte: hourAgo } },
  });
  if (recentSends >= OTP_SENDS_PER_HOUR) {
    return { ok: true, throttled: true };
  }

  await prisma.registrantLookupOtp.deleteMany({
    where: { emailNormalized: args.emailNormalized, consumedAt: null },
  });

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const codeHash = await hash(code, BCRYPT_OTP_ROUNDS);
  const expiresAt = new Date(Date.now() + OTP_TTL_MIN * 60 * 1000);

  const otpRow = await prisma.registrantLookupOtp.create({
    data: {
      emailNormalized: args.emailNormalized,
      registrationCode: args.registrationCode ?? null,
      codeHash,
      expiresAt,
    },
  });

  const send = await sendRegistrantLookupOtpEmail({
    toEmail: args.emailNormalized,
    toName: args.emailNormalized.split("@")[0] || "there",
    code,
    minutesValid: OTP_TTL_MIN,
  });

  if (send.mode !== "sent") {
    await prisma.registrantLookupOtp.delete({ where: { id: otpRow.id } }).catch(() => {});
    if (send.mode === "skipped_no_provider") {
      return { ok: false, message: "Email is not configured. Contact the VBS team for help." };
    }
    return { ok: false, message: `Could not send the code: ${send.error}` };
  }

  return { ok: true, otpSentTo: maskRegistrantLookupEmail(args.emailNormalized) };
}

const submissionLookupInclude = {
  guardian: true,
  season: { select: { name: true } },
  registrations: {
    where: registrantLookupRegistrationWhere,
    include: { child: { include: { guardian: true } } },
  },
} as const;

function childLabel(firstName: string, lastName: string): string {
  const n = `${firstName} ${lastName}`.trim();
  return n || "Child registration";
}

function pickItemFromSubmission(
  submission: {
    id: string;
    registrationCode: string;
    season: { name: string };
    registrations: Array<{
      registrationNumber: string | null;
      child: { firstName: string; lastName: string };
    }>;
  },
): RegistrantLookupPickItem {
  return {
    key: submission.id,
    kind: "submission",
    registrationCode: submission.registrationCode,
    seasonName: submission.season.name,
    childNames: submission.registrations.map((r) => childLabel(r.child.firstName, r.child.lastName)).join(", "),
    registrationNumbers: submission.registrations
      .map((r) => r.registrationNumber)
      .filter(Boolean)
      .join(", "),
  };
}

/** Find editable registrations using each season's configured lookup email field. */
async function findLookupPickItems(
  emailNormalized: string,
  registrationCode?: string,
): Promise<RegistrantLookupPickItem[]> {
  const registrations = await findRegistrationsForLookupEmail(emailNormalized, registrationCode);

  type RegistrationRow = (typeof registrations)[number];
  const submissionIdList: string[] = [];
  const standalone: RegistrationRow[] = [];

  for (const reg of registrations) {
    if (reg.formSubmissionId && reg.formSubmission) {
      if (!submissionIdList.includes(reg.formSubmissionId)) {
        submissionIdList.push(reg.formSubmissionId);
      }
    } else {
      standalone.push(reg);
    }
  }

  const pickItems: RegistrantLookupPickItem[] = [];

  if (submissionIdList.length > 0) {
    const submissions = await prisma.formSubmission.findMany({
      where: { id: { in: submissionIdList } },
      orderBy: { submittedAt: "desc" },
      include: submissionLookupInclude,
    });
    for (const submission of submissions) {
      if (submission.registrations.length === 0) continue;
      pickItems.push(pickItemFromSubmission(submission));
    }
  }

  for (const reg of standalone) {
    pickItems.push({
      key: reg.id,
      kind: "registration",
      registrationCode: reg.registrationNumber ?? reg.id.slice(-8).toUpperCase(),
      seasonName: reg.season.name,
      childNames: childLabel(reg.child.firstName, reg.child.lastName),
      registrationNumbers: reg.registrationNumber ?? "",
    });
  }

  return pickItems;
}

async function openLookupSession(item: RegistrantLookupPickItem, emailNormalized: string): Promise<boolean> {
  const session: RegistrantLookupSession =
    item.kind === "submission"
      ? { kind: "submission", submissionId: item.key, emailNormalized }
      : { kind: "registration", registrationId: item.key, emailNormalized };
  return setRegistrantLookupSessionCookie(session);
}

export async function requestRegistrantLookupOtpAction(
  formData: FormData,
): Promise<RegistrantLookupActionState> {
  const lookupMethod = parseLookupMethod(String(formData.get("lookupMethod") ?? "email"));
  const registrationCodeInput = String(formData.get("registrationCode") ?? "").trim();
  const emailInput = normalizeRegistrantLookupEmail(String(formData.get("email") ?? ""));
  const phoneInput = String(formData.get("phone") ?? "").trim();
  const selectedEmail = normalizeRegistrantLookupEmail(String(formData.get("selectedEmail") ?? ""));

  try {
  if (!isMicrosoftGraphEmailConfigured()) {
    return {
      ok: false,
      message:
        "Email verification is not available right now. Contact the VBS team for help with your registration.",
    };
  }

  let targetEmail: string | null = null;
  let registrationCode: string | undefined;

  if (lookupMethod === "registration_number") {
    if (!registrationCodeInput) {
      return { ok: false, message: "Enter your registration number." };
    }
    const resolved = await resolveEmailForRegistrationNumberLookup(registrationCodeInput);
    if (!resolved) {
      return { ok: true, message: neutralMessage(), lookupMethod };
    }
    targetEmail = resolved.emailNormalized;
    registrationCode = resolved.registrationCode;
  } else if (lookupMethod === "email") {
    const parsedEmail = emailSchema.safeParse(emailInput);
    if (!parsedEmail.success) {
      return { ok: false, message: "Enter the email address used on your registration." };
    }
    targetEmail = parsedEmail.data;
    registrationCode = registrationCodeInput || undefined;
  } else {
    const phoneDigits = normalizeRegistrantLookupPhone(phoneInput);
    if (phoneDigits.length < 10) {
      return { ok: false, message: "Enter a valid 10-digit phone number." };
    }

    if (selectedEmail) {
      const parsedSelected = emailSchema.safeParse(selectedEmail);
      if (!parsedSelected.success) {
        return { ok: false, message: "Choose a valid email address." };
      }
      const phoneOk = await emailMatchesPhoneForLookup(parsedSelected.data, phoneInput);
      if (!phoneOk) {
        return { ok: false, message: "That email is not linked to this phone number." };
      }
      targetEmail = parsedSelected.data;
    } else {
      const options = await findEmailOptionsForPhoneLookup(phoneInput);
      if (options.length === 0) {
        return { ok: true, message: neutralMessage(), lookupMethod, phone: phoneInput };
      }
      return {
        ok: true,
        step: "pick_email",
        lookupMethod,
        phone: phoneInput,
        emailOptions: options,
        message:
          options.length === 1
            ? "We found one email linked to this phone number. Confirm where to send your verification code."
            : "We found several emails linked to this phone number. Choose where to send your verification code.",
      };
    }
  }

  if (!targetEmail) {
    return { ok: true, message: neutralMessage(), lookupMethod };
  }

  const pickItems = await findLookupPickItems(targetEmail, registrationCode);
  if (pickItems.length === 0) {
    return { ok: true, message: neutralMessage(), lookupMethod };
  }

  const sendResult = await sendOtpToEmail({
    emailNormalized: targetEmail,
    registrationCode,
  });

  if (!sendResult.ok) {
    return { ok: false, message: sendResult.message, lookupMethod };
  }

  const otpSentTo = "otpSentTo" in sendResult ? sendResult.otpSentTo : maskRegistrantLookupEmail(targetEmail);

  return {
    ok: true,
    step: "verify",
    lookupMethod,
    email: targetEmail,
    otpSentTo,
    registrationCode,
    phone: lookupMethod === "phone" ? phoneInput : undefined,
    message: "throttled" in sendResult && sendResult.throttled ? neutralMessage() : otpSentMessage(otpSentTo),
  };
  } catch (err) {
    console.error("[requestRegistrantLookupOtpAction]", err);
    return {
      ok: false,
      message: "Something went wrong while looking up your registration. Please try again in a moment.",
      lookupMethod,
    };
  }
}

export async function verifyRegistrantLookupOtpAction(
  formData: FormData,
): Promise<RegistrantLookupActionState> {
  const emailNormalized = normalizeRegistrantLookupEmail(String(formData.get("email") ?? ""));
  const parsedEmail = emailSchema.safeParse(emailNormalized);
  if (!parsedEmail.success) {
    return { ok: false, message: "Enter a valid email address." };
  }

  const code = String(formData.get("code") ?? "").replace(/\D/g, "").slice(0, 6);
  if (code.length !== 6) {
    return { ok: false, message: "Enter the 6-digit code from your email." };
  }

  const otp = await prisma.registrantLookupOtp.findFirst({
    where: {
      emailNormalized: parsedEmail.data,
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!otp) {
    return { ok: false, message: "Invalid or expired code. Request a new code." };
  }

  if (otp.attempts >= MAX_OTP_ATTEMPTS) {
    await prisma.registrantLookupOtp.update({
      where: { id: otp.id },
      data: { consumedAt: new Date() },
    });
    return { ok: false, message: "Too many incorrect attempts. Request a new code." };
  }

  const codeOk = await compare(code, otp.codeHash);
  if (!codeOk) {
    await prisma.registrantLookupOtp.update({
      where: { id: otp.id },
      data: { attempts: { increment: 1 } },
    });
    return { ok: false, message: "Incorrect code. Check your email and try again." };
  }

  await prisma.registrantLookupOtp.update({
    where: { id: otp.id },
    data: { consumedAt: new Date() },
  });

  const registrationCode =
    String(formData.get("registrationCode") ?? "").trim() || otp.registrationCode?.trim() || undefined;

  const pickItems = await findLookupPickItems(parsedEmail.data, registrationCode);
  if (pickItems.length === 0) {
    return { ok: false, message: "Registration not found. Request a new code." };
  }

  if (pickItems.length === 1) {
    const ok = await openLookupSession(pickItems[0]!, parsedEmail.data);
    if (!ok) {
      return {
        ok: false,
        message:
          "Could not start your session. The server may be missing AUTH_SECRET — contact the VBS team.",
      };
    }
    redirect("/register/lookup/edit");
  }

  return {
    ok: true,
    message: "Verified. Choose which registration to open.",
    step: "pick_submission",
    submissions: pickItems,
  };
}

export async function openRegistrantSubmissionAction(
  lookupKey: string,
  lookupKind: RegistrantLookupPickItem["kind"],
  emailNormalized: string,
): Promise<RegistrantLookupActionState> {
  const email = normalizeRegistrantLookupEmail(emailNormalized);
  const pickItems = await findLookupPickItems(email);
  const item = pickItems.find((p) => p.key === lookupKey && p.kind === lookupKind);
  if (!item) {
    return { ok: false, message: "Registration not found for this email." };
  }

  const ok = await openLookupSession(item, email);
  if (!ok) {
    return { ok: false, message: "Could not start your session. Try again." };
  }
  redirect("/register/lookup/edit");
}

export async function saveRegistrantSubmissionAction(
  formData: FormData,
): Promise<RegistrantLookupActionState> {
  const session = await readRegistrantLookupSession();
  if (!session) {
    return { ok: false, message: "Your session expired. Look up your registration again." };
  }

  const registrationIds = formData
    .getAll("registrationIds")
    .map((v) => String(v).trim())
    .filter(Boolean);
  if (registrationIds.length === 0) {
    return { ok: false, message: "No registration selected to update." };
  }

  if (session.kind === "registration") {
    if (registrationIds.length !== 1 || registrationIds[0] !== session.registrationId) {
      return { ok: false, message: "Session mismatch. Look up your registration again." };
    }

    const reg = await prisma.registration.findFirst({
      where: {
        id: session.registrationId,
        ...registrantLookupRegistrationWhere,
      },
      include: {
        ...registrantLookupRegistrationInclude,
        child: { include: { guardian: true } },
        season: { include: { publicRegistrationSettings: true, registrationForm: true } },
      },
    });
    if (!reg || !registrationMatchesLookupEmail(reg, session.emailNormalized)) {
      return { ok: false, message: "Registration not found." };
    }

    const definition =
      getEffectiveDefinition(
        {
          publishedDefinitionJson: reg.season.registrationForm?.publishedDefinitionJson ?? null,
          draftDefinitionJson: reg.season.registrationForm?.draftDefinitionJson ?? null,
        },
        false,
      ) ?? createDefaultFormDefinition();
    const rules = rulesFromDb(reg.season.publicRegistrationSettings);
    const parsed = parseRegistrantEditForm(formData, definition, registrationIds, rules);
    if (!parsed.ok) return { ok: false, message: parsed.message };

    const child = parsed.children[0]!;
    const priorCustom = (reg.customResponses as Record<string, unknown> | null) ?? {};
    const persistResult = await prisma.$transaction(async (tx) =>
      persistSingleRegistrationFormEntries(tx, {
        registrationId: reg.id,
        guardianId: reg.child.guardianId,
        childId: reg.childId,
        priorCustom,
        parsed,
      }),
    );
    if (!persistResult.ok) return { ok: false, message: persistResult.message };

    revalidatePath("/register/lookup/edit");
    revalidatePath("/registrations");
    return { ok: true, message: "Your registration has been updated." };
  }

  const submission = await prisma.formSubmission.findUnique({
    where: { id: session.submissionId },
    include: {
      guardian: true,
      registrations: {
        where: registrantLookupRegistrationWhere,
        include: { child: { include: { guardian: true } } },
      },
      season: { include: { publicRegistrationSettings: true, registrationForm: true } },
    },
  });
  if (!submission || submission.registrations.length === 0) {
    return { ok: false, message: "Registration not found." };
  }

  if (
    !submissionMatchesLookupEmail({
      emailNormalized: session.emailNormalized,
      form: submission.season.registrationForm,
      guardian: submission.guardian,
      guardianResponses: (submission.guardianResponses as Record<string, unknown> | null) ?? {},
      registrations: submission.registrations,
    })
  ) {
    return { ok: false, message: "Session mismatch. Look up your registration again." };
  }

  const allowedIds = new Set(submission.registrations.map((r) => r.id));
  if (!registrationIds.every((id) => allowedIds.has(id))) {
    return { ok: false, message: "One or more registrations could not be updated." };
  }

  const definition =
    getEffectiveDefinition(
      {
        publishedDefinitionJson: submission.season.registrationForm?.publishedDefinitionJson ?? null,
        draftDefinitionJson: submission.season.registrationForm?.draftDefinitionJson ?? null,
      },
      false,
    ) ?? createDefaultFormDefinition();
  const rules = rulesFromDb(submission.season.publicRegistrationSettings);
  const parsed = parseRegistrantEditForm(formData, definition, registrationIds, rules);
  if (!parsed.ok) return { ok: false, message: parsed.message };

  const priorResponses = (submission.guardianResponses as Record<string, unknown> | null) ?? {};
  const persistResult = await prisma.$transaction(async (tx) =>
    persistSubmissionFormEntries(tx, {
      submissionId: submission.id,
      guardianId: submission.guardianId,
      priorGuardianResponses: priorResponses,
      parsed,
      registrations: submission.registrations.map((r) => ({
        id: r.id,
        childId: r.childId,
        customResponses: r.customResponses,
      })),
    }),
  );
  if (!persistResult.ok) return { ok: false, message: persistResult.message };

  revalidatePath("/register/lookup/edit");
  revalidatePath("/registrations");

  return { ok: true, message: "Your registration has been updated." };
}

export async function signOutRegistrantLookupAction(): Promise<void> {
  await clearRegistrantLookupSessionCookie();
}

async function resolveLookupFormSubmissionId(
  session: RegistrantLookupSession,
): Promise<
  | { ok: true; formSubmissionId: string }
  | { ok: false; message: string }
> {
  if (session.kind === "submission") {
    const submission = await prisma.formSubmission.findUnique({
      where: { id: session.submissionId },
      include: {
        guardian: true,
        season: { select: { registrationForm: true } },
        registrations: {
          where: registrantLookupRegistrationWhere,
          include: { child: { include: { guardian: true } } },
        },
      },
    });
    if (!submission || submission.registrations.length === 0) {
      return { ok: false, message: "Registration not found." };
    }
    if (
      !submissionMatchesLookupEmail({
        emailNormalized: session.emailNormalized,
        form: submission.season.registrationForm,
        guardian: submission.guardian,
        guardianResponses: (submission.guardianResponses as Record<string, unknown> | null) ?? {},
        registrations: submission.registrations,
      })
    ) {
      return { ok: false, message: "Session mismatch. Look up your registration again." };
    }
    return { ok: true, formSubmissionId: submission.id };
  }

  const reg = await prisma.registration.findFirst({
    where: {
      id: session.registrationId,
      ...registrantLookupRegistrationWhere,
    },
    include: registrantLookupRegistrationInclude,
  });
  if (!reg || !registrationMatchesLookupEmail(reg, session.emailNormalized)) {
    return { ok: false, message: "Registration not found." };
  }
  if (!reg.formSubmissionId) {
    return { ok: false, message: "This registration does not have an online payment on file." };
  }
  return { ok: true, formSubmissionId: reg.formSubmissionId };
}

export async function startRegistrantLookupPaymentAction(): Promise<RegistrantLookupActionState> {
  const session = await readRegistrantLookupSession();
  if (!session) {
    return { ok: false, message: "Your session expired. Look up your registration again." };
  }

  const resolved = await resolveLookupFormSubmissionId(session);
  if (!resolved.ok) return { ok: false, message: resolved.message };

  const submission = await prisma.formSubmission.findUnique({
    where: { id: resolved.formSubmissionId },
    include: {
      registrations: {
        where: registrantLookupRegistrationWhere,
        select: {
          expectsPayment: true,
          paymentReceivedAt: true,
        },
      },
    },
  });
  if (!submission) {
    return { ok: false, message: "Registration not found." };
  }

  const sample = submission.registrations[0];
  if (!sample) {
    return { ok: false, message: "Registration not found." };
  }

  const paymentInput = {
    expectsPayment: sample.expectsPayment,
    paymentReceivedAt: sample.paymentReceivedAt,
    formSubmission: {
      stripePaymentStatus: submission.stripePaymentStatus,
      stripeCheckoutSessionId: submission.stripeCheckoutSessionId,
    },
  };

  if (
    !canPayRegistrationOnline({
      ...paymentInput,
      formSubmissionId: submission.id,
    })
  ) {
    return { ok: false, message: "No online payment is due for this registration." };
  }

  const base = getPublicAppBaseUrl();
  const resume = await resolveCheckoutResumeUrlForSubmission(submission.id, {
    cancelUrl: `${base}/register/lookup/edit?payment=canceled`,
  });
  if ("error" in resume) {
    return { ok: false, message: resume.error };
  }

  return {
    ok: true,
    message: "Redirecting to secure checkout…",
    stripeCheckoutUrl: resume.url,
  };
}
