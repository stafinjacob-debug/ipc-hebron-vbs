"use server";

import { randomInt } from "crypto";
import { compare, hash } from "bcryptjs";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
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
  registrantLookupEmailMatchesSubmission,
  registrantLookupRegistrationForEmail,
  registrantLookupRegistrationWhere,
  registrantLookupSubmissionForEmail,
  type RegistrantLookupPickItem,
} from "@/lib/registrant-lookup";
import { revalidatePath } from "next/cache";

export type RegistrantLookupActionState = {
  ok: boolean;
  message: string;
  step?: "pick_submission";
  submissions?: RegistrantLookupPickItem[];
};

const OTP_TTL_MIN = 15;
const OTP_SENDS_PER_HOUR = 6;
const MAX_OTP_ATTEMPTS = 8;
const BCRYPT_OTP_ROUNDS = 10;

const emailSchema = z.string().email();

function neutralMessage(): string {
  return "If we found a matching registration with that email, we sent a 6-digit code. It expires in 15 minutes.";
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

/** Find editable registrations the same way the admin list does — by guardian email on the child profile. */
async function findLookupPickItems(
  emailNormalized: string,
  registrationCode?: string,
): Promise<RegistrantLookupPickItem[]> {
  const registrationWhere: Prisma.RegistrationWhereInput = {
    ...registrantLookupRegistrationForEmail(emailNormalized),
    ...(registrationCode?.trim()
      ? {
          OR: [
            { formSubmission: { registrationCode: registrationCode.trim() } },
            {
              registrationNumber: {
                equals: registrationCode.trim(),
                mode: "insensitive",
              },
            },
          ],
        }
      : {}),
  };

  const registrations = await prisma.registration.findMany({
    where: registrationWhere,
    orderBy: { registeredAt: "desc" },
    take: 50,
    select: {
      id: true,
      registrationNumber: true,
      formSubmissionId: true,
      season: { select: { name: true } },
      child: { select: { firstName: true, lastName: true } },
      formSubmission: {
        select: {
          id: true,
          registrationCode: true,
          season: { select: { name: true } },
        },
      },
    },
  });

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
      where: {
        id: { in: submissionIdList },
        ...registrantLookupSubmissionForEmail(emailNormalized),
      },
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
  const emailNormalized = normalizeRegistrantLookupEmail(String(formData.get("email") ?? ""));
  const parsedEmail = emailSchema.safeParse(emailNormalized);
  if (!parsedEmail.success) {
    return { ok: false, message: "Enter the email address used on your registration." };
  }

  const registrationCode = String(formData.get("registrationCode") ?? "").trim() || undefined;

  if (!isMicrosoftGraphEmailConfigured()) {
    return {
      ok: false,
      message:
        "Email verification is not available right now. Contact the VBS team for help with your registration.",
    };
  }

  const pickItems = await findLookupPickItems(parsedEmail.data, registrationCode);
  if (pickItems.length === 0) {
    return { ok: true, message: neutralMessage() };
  }

  const sendTo = parsedEmail.data;

  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentSends = await prisma.registrantLookupOtp.count({
    where: { emailNormalized: parsedEmail.data, createdAt: { gte: hourAgo } },
  });
  if (recentSends >= OTP_SENDS_PER_HOUR) {
    return { ok: true, message: neutralMessage() };
  }

  await prisma.registrantLookupOtp.deleteMany({
    where: { emailNormalized: parsedEmail.data, consumedAt: null },
  });

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const codeHash = await hash(code, BCRYPT_OTP_ROUNDS);
  const expiresAt = new Date(Date.now() + OTP_TTL_MIN * 60 * 1000);

  const otpRow = await prisma.registrantLookupOtp.create({
    data: {
      emailNormalized: parsedEmail.data,
      registrationCode: registrationCode ?? null,
      codeHash,
      expiresAt,
    },
  });

  const send = await sendRegistrantLookupOtpEmail({
    toEmail: sendTo,
    toName: sendTo.split("@")[0] || "there",
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
      return { ok: false, message: "Could not start your session. Try again." };
    }
    return { ok: true, message: "Verified. Opening your registration…" };
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
  return { ok: true, message: "Opening your registration…" };
}

export async function saveRegistrantSubmissionAction(
  formData: FormData,
): Promise<RegistrantLookupActionState> {
  const session = await readRegistrantLookupSession();
  if (!session) {
    return { ok: false, message: "Your session expired. Look up your registration again." };
  }

  const fn = String(formData.get("g_first") ?? "").trim();
  const ln = String(formData.get("g_last") ?? "").trim();
  const email = String(formData.get("g_email") ?? "").trim() || null;
  const phone = String(formData.get("g_phone") ?? "").trim() || null;

  if (!fn || !ln) {
    return { ok: false, message: "Guardian first and last name are required." };
  }

  if (session.kind === "registration") {
    const reg = await prisma.registration.findFirst({
      where: {
        id: session.registrationId,
        ...registrantLookupRegistrationForEmail(session.emailNormalized),
      },
      include: { child: { include: { guardian: true } } },
    });
    if (!reg) {
      return { ok: false, message: "Registration not found." };
    }

    let customResponses: object | undefined;
    const childJson = String(formData.get(`child_json_${reg.id}`) ?? "").trim();
    if (childJson) {
      try {
        customResponses = JSON.parse(childJson) as object;
      } catch {
        return { ok: false, message: "Custom child responses must be valid JSON." };
      }
    }

    const allergies = String(formData.get(`allergies_${reg.id}`) ?? "").trim() || null;

    await prisma.$transaction(async (tx) => {
      await tx.guardian.update({
        where: { id: reg.child.guardianId },
        data: { firstName: fn, lastName: ln, email, phone },
      });
      if (customResponses) {
        await tx.registration.update({
          where: { id: reg.id },
          data: { customResponses },
        });
      }
      await tx.child.update({
        where: { id: reg.childId },
        data: { allergiesNotes: allergies },
      });
    });

    revalidatePath("/register/lookup/edit");
    revalidatePath("/registrations");
    return { ok: true, message: "Your registration has been updated." };
  }

  const submission = await prisma.formSubmission.findFirst({
    where: {
      id: session.submissionId,
      ...registrantLookupSubmissionForEmail(session.emailNormalized),
    },
    include: {
      guardian: true,
      registrations: {
        where: registrantLookupRegistrationWhere,
        include: { child: { include: { guardian: true } } },
      },
    },
  });
  if (!submission) {
    return { ok: false, message: "Registration not found." };
  }

  if (
    !registrantLookupEmailMatchesSubmission({
      emailNormalized: session.emailNormalized,
      submissionGuardianEmail: submission.guardian.email,
      registrationGuardianEmails: submission.registrations.map((r) => r.child.guardian.email),
    })
  ) {
    return { ok: false, message: "Session mismatch. Look up your registration again." };
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
