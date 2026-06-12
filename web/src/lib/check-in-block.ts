import {
  resolveRegistrationExportFieldValue,
  type RegistrationFieldValueRow,
} from "@/lib/registration-export";
import { registrationListPaymentBadge } from "@/lib/registration-list-payment";

export const PAYMENT_STATUS_FIELD_KEY = "core:paymentStatus";

export const PAYMENT_STATUS_OPTIONS = [
  "Paid",
  "Due",
  "Checkout pending",
  "Due (checkout canceled)",
  "Not required",
] as const;

export type CheckInBlockSettings = {
  enabled: boolean;
  fieldKey: string;
  blockedValues: string[];
  message: string;
};

export const DEFAULT_CHECK_IN_BLOCK_MESSAGE =
  "Check-in is not allowed for this registration. Please visit the registration desk.";

const DEFAULT_SETTINGS: CheckInBlockSettings = {
  enabled: false,
  fieldKey: PAYMENT_STATUS_FIELD_KEY,
  blockedValues: ["Due"],
  message: "Payment is due. Please visit the registration desk before checking in.",
};

export function parseCheckInBlockSettings(json: string | null | undefined): CheckInBlockSettings {
  if (!json?.trim()) return { ...DEFAULT_SETTINGS };
  try {
    const parsed = JSON.parse(json) as Partial<CheckInBlockSettings>;
    const blockedValues = Array.isArray(parsed.blockedValues)
      ? parsed.blockedValues.map((v) => String(v).trim()).filter(Boolean)
      : DEFAULT_SETTINGS.blockedValues;
    return {
      enabled: Boolean(parsed.enabled),
      fieldKey:
        typeof parsed.fieldKey === "string" && parsed.fieldKey.trim()
          ? parsed.fieldKey.trim()
          : DEFAULT_SETTINGS.fieldKey,
      blockedValues,
      message:
        typeof parsed.message === "string" && parsed.message.trim()
          ? parsed.message.trim()
          : DEFAULT_SETTINGS.message,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function serializeCheckInBlockSettings(settings: CheckInBlockSettings): string {
  return JSON.stringify(settings);
}

export type CheckInBlockRegistrationRow = RegistrationFieldValueRow & {
  expectsPayment: boolean;
  paymentReceivedAt: Date | null;
  formSubmission: RegistrationFieldValueRow["formSubmission"] & {
    stripePaymentStatus?: string | null;
    stripeCheckoutSessionId?: string | null;
  } | null;
};

export function resolveCheckInBlockFieldValue(
  row: CheckInBlockRegistrationRow,
  seasonName: string,
  fieldKey: string,
): string {
  if (fieldKey === PAYMENT_STATUS_FIELD_KEY) {
    return registrationListPaymentBadge({
      paymentReceivedAt: row.paymentReceivedAt,
      expectsPayment: row.expectsPayment,
      formSubmission: row.formSubmission
        ? {
            stripePaymentStatus: row.formSubmission.stripePaymentStatus ?? null,
            stripeCheckoutSessionId: row.formSubmission.stripeCheckoutSessionId ?? null,
          }
        : null,
    }).label;
  }
  return resolveRegistrationExportFieldValue(row, seasonName, fieldKey);
}

export function evaluateCheckInBlock(
  row: CheckInBlockRegistrationRow,
  seasonName: string,
  settings: CheckInBlockSettings,
): { blocked: true; message: string } | { blocked: false } {
  if (!settings.enabled || !settings.fieldKey || settings.blockedValues.length === 0) {
    return { blocked: false };
  }

  const value = resolveCheckInBlockFieldValue(row, seasonName, settings.fieldKey);
  const normalizedValue = value.trim().toLowerCase();
  const isBlocked = settings.blockedValues.some(
    (blocked) => blocked.trim().toLowerCase() === normalizedValue,
  );

  if (!isBlocked) return { blocked: false };

  return {
    blocked: true,
    message: settings.message.trim() || DEFAULT_CHECK_IN_BLOCK_MESSAGE,
  };
}

export const CHECK_IN_BLOCK_REGISTRATION_SELECT = {
  id: true,
  registrationNumber: true,
  status: true,
  registeredAt: true,
  notes: true,
  customResponses: true,
  expectsPayment: true,
  paymentReceivedAt: true,
  child: {
    select: {
      firstName: true,
      lastName: true,
      dateOfBirth: true,
      allergiesNotes: true,
      guardian: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
        },
      },
    },
  },
  classroom: { select: { name: true } },
  formSubmission: {
    select: {
      registrationCode: true,
      guardianResponses: true,
      stripePaymentStatus: true,
      stripeCheckoutSessionId: true,
    },
  },
} as const;
