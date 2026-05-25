"use server";

import { randomInt } from "crypto";
import { compare, hash } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendRegistrantLookupOtpEmail } from "@/lib/email/send-registrant-lookup-otp-email";
import { isMicrosoftGraphEmailConfigured } from "@/lib/email/microsoft-graph";
import {
  clearRegistrantLookupSessionCookie,
  readRegistrantLookupSession,
  setRegistrantLookupSessionCookie,
} from "@/lib/registrant-lookup-session";
import {
  registrantLookupRegistrationWhere,
  registrantLookupSubmissionWhere,
} from "@/lib/registrant-lookup";
import { revalidatePath } from "next/cache";

export type RegistrantLookupActionState = {
  ok: boolean;
  message: string;
  step?: "pick_submission";
  submissions?: Array<{
    id: string;
    registrationCode: string;
    seasonName: string;
    childNames: string;
  }>;
};

const OTP_TTL_MIN = 15;
const OTP_SENDS_PER_HOUR = 6;
const MAX_OTP_ATTEMPTS = 8;
const BCRYPT_OTP_ROUNDS = 10;

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

const emailSchema = z.string().email();

function neutralMessage(): string {
  return "If we found a matching registration with that email, we sent a 6-digit code. It expires in 15 minutes.";
}

const submissionLookupInclude = {
  guardian: true,
  season: { select: { name: true } },
  registrations: {
    where: registrantLookupRegistrationWhere,
    include: { child: true },
  },
} as const;

async function findSubmissionsForLookup(emailNormalized: string, registrationCode?: string) {
  if (registrationCode?.trim()) {
    const code = registrationCode.trim();
    const submission = await prisma.formSubmission.findFirst({
      where: {
        registrationCode: code,
        ...registrantLookupSubmissionWhere,
      },
      include: submissionLookupInclude,
    });
    if (!submission) return [];
    const guardianEmail = normalizeEmail(submission.guardian.email ?? "");
    if (!guardianEmail || guardianEmail !== emailNormalized) return [];
    return [submission];
  }

  return prisma.formSubmission.findMany({
    where: {
      guardian: { email: { equals: emailNormalized, mode: "insensitive" } },
      ...registrantLookupSubmissionWhere,
    },
    orderBy: { submittedAt: "desc" },
    take: 20,
    include: submissionLookupInclude,
  });
}

export async function requestRegistrantLookupOtpAction(
  formData: FormData,
): Promise<RegistrantLookupActionState> {
  const rawEmail = normalizeEmail(String(formData.get("email") ?? ""));
  const parsedEmail = emailSchema.safeParse(rawEmail);
  if (!parsedEmail.success) {
    return { ok: false, message: "Enter the email address used on your registration." };
  }
  const emailNormalized = parsedEmail.data;

  const registrationCode = String(formData.get("registrationCode") ?? "").trim() || undefined;

  if (!isMicrosoftGraphEmailConfigured()) {
    return {
      ok: false,
      message:
        "Email verification is not available right now. Contact the VBS team for help with your registration.",
    };
  }

  const submissions = await findSubmissionsForLookup(emailNormalized, registrationCode);
  if (submissions.length === 0) {
    return { ok: true, message: neutralMessage() };
  }

  const sendTo = submissions[0]!.guardian.email?.trim();
  if (!sendTo) {
    return { ok: true, message: neutralMessage() };
  }

  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentSends = await prisma.registrantLookupOtp.count({
    where: { emailNormalized, createdAt: { gte: hourAgo } },
  });
  if (recentSends >= OTP_SENDS_PER_HOUR) {
    return { ok: true, message: neutralMessage() };
  }

  await prisma.registrantLookupOtp.deleteMany({
    where: { emailNormalized, consumedAt: null },
  });

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const codeHash = await hash(code, BCRYPT_OTP_ROUNDS);
  const expiresAt = new Date(Date.now() + OTP_TTL_MIN * 60 * 1000);

  const otpRow = await prisma.registrantLookupOtp.create({
    data: {
      emailNormalized,
      registrationCode: registrationCode ?? null,
      codeHash,
      expiresAt,
    },
  });

  const toName =
    `${submissions[0]!.guardian.firstName} ${submissions[0]!.guardian.lastName}`.trim() ||
    sendTo.split("@")[0] ||
    "there";

  const send = await sendRegistrantLookupOtpEmail({
    toEmail: sendTo,
    toName,
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

  return { ok: true, message: neutralMessage() };
}

export async function verifyRegistrantLookupOtpAction(
  formData: FormData,
): Promise<RegistrantLookupActionState> {
  const rawEmail = normalizeEmail(String(formData.get("email") ?? ""));
  const parsedEmail = emailSchema.safeParse(rawEmail);
  if (!parsedEmail.success) {
    return { ok: false, message: "Enter a valid email address." };
  }
  const emailNormalized = parsedEmail.data;

  const code = String(formData.get("code") ?? "").replace(/\D/g, "").slice(0, 6);
  if (code.length !== 6) {
    return { ok: false, message: "Enter the 6-digit code from your email." };
  }

  const registrationCode = String(formData.get("registrationCode") ?? "").trim() || undefined;

  const otp = await prisma.registrantLookupOtp.findFirst({
    where: {
      emailNormalized,
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

  const submissions = await findSubmissionsForLookup(emailNormalized, registrationCode);
  if (submissions.length === 0) {
    return { ok: false, message: "Registration not found. Request a new code." };
  }

  if (submissions.length === 1) {
    const ok = await setRegistrantLookupSessionCookie(submissions[0]!.id, emailNormalized);
    if (!ok) {
      return { ok: false, message: "Could not start your session. Try again." };
    }
    return { ok: true, message: "Verified. Opening your registration…" };
  }

  return {
    ok: true,
    message: "Verified. Choose which registration to open.",
    step: "pick_submission",
    submissions: submissions.map((s) => ({
      id: s.id,
      registrationCode: s.registrationCode,
      seasonName: s.season.name,
      childNames: s.registrations.map((r) => `${r.child.firstName} ${r.child.lastName}`).join(", "),
    })),
  };
}

export async function openRegistrantSubmissionAction(
  submissionId: string,
  emailNormalized: string,
): Promise<RegistrantLookupActionState> {
  const email = normalizeEmail(emailNormalized);
  const submission = await prisma.formSubmission.findFirst({
    where: {
      id: submissionId,
      guardian: { email: { equals: email, mode: "insensitive" } },
      ...registrantLookupSubmissionWhere,
    },
    select: { id: true },
  });
  if (!submission) {
    return { ok: false, message: "Registration not found for this email." };
  }

  const ok = await setRegistrantLookupSessionCookie(submission.id, email);
  if (!ok) {
    return { ok: false, message: "Could not start your session. Try again." };
  }
  return { ok: true, message: "Opening your registration…" };
}

export async function saveRegistrantSubmissionAction(
  formData: FormData,
): Promise<RegistrantLookupActionState> {
  const session = await readRegistrantLookupSession();
  if (!session) {
    return { ok: false, message: "Your session expired. Look up your registration again." };
  }

  const submission = await prisma.formSubmission.findFirst({
    where: {
      id: session.submissionId,
      ...registrantLookupSubmissionWhere,
    },
    include: {
      guardian: true,
      registrations: {
        where: registrantLookupRegistrationWhere,
        include: { child: true },
      },
    },
  });
  if (!submission) {
    return { ok: false, message: "Registration not found." };
  }

  const guardianEmail = normalizeEmail(submission.guardian.email ?? "");
  if (guardianEmail !== session.emailNormalized) {
    return { ok: false, message: "Session mismatch. Look up your registration again." };
  }

  const fn = String(formData.get("g_first") ?? "").trim();
  const ln = String(formData.get("g_last") ?? "").trim();
  const email = String(formData.get("g_email") ?? "").trim() || null;
  const phone = String(formData.get("g_phone") ?? "").trim() || null;

  if (!fn || !ln) {
    return { ok: false, message: "Guardian first and last name are required." };
  }

  let guardianResponses: object = {};
  const guardianJson = String(formData.get("g_json") ?? "").trim();
  if (guardianJson) {
    try {
      guardianResponses = JSON.parse(guardianJson) as object;
    } catch {
      return { ok: false, message: "Custom guardian responses must be valid JSON." };
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.guardian.update({
        where: { id: submission.guardianId },
        data: { firstName: fn, lastName: ln, email, phone },
      });
      await tx.formSubmission.update({
        where: { id: submission.id },
        data: { guardianResponses },
      });

      for (const reg of submission.registrations) {
        const childJson = String(formData.get(`child_json_${reg.id}`) ?? "").trim();
        if (childJson) {
          let customResponses: object = {};
          try {
            customResponses = JSON.parse(childJson) as object;
          } catch {
            throw new Error("INVALID_CHILD_JSON");
          }
          await tx.registration.update({
            where: { id: reg.id },
            data: { customResponses },
          });
        }
        const allergies = String(formData.get(`allergies_${reg.id}`) ?? "").trim() || null;
        await tx.child.update({
          where: { id: reg.childId },
          data: { allergiesNotes: allergies },
        });
      }
    });
  } catch (e) {
    if (e instanceof Error && e.message === "INVALID_CHILD_JSON") {
      return { ok: false, message: "Custom child responses must be valid JSON." };
    }
    throw e;
  }

  revalidatePath("/register/lookup/edit");
  revalidatePath("/registrations");

  return { ok: true, message: "Your registration has been updated." };
}

export async function signOutRegistrantLookupAction(): Promise<void> {
  await clearRegistrantLookupSessionCookie();
}
