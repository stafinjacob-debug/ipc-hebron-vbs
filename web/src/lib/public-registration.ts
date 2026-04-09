import { z } from "zod";

/** Effective toggles for the public form (DB row or defaults). */
export type PublicRegistrationFieldRules = {
  requireGuardianEmail: boolean;
  requireGuardianPhone: boolean;
  requireAllergiesNotes: boolean;
};

export const defaultPublicFieldRules: PublicRegistrationFieldRules = {
  requireGuardianEmail: false,
  requireGuardianPhone: false,
  requireAllergiesNotes: false,
};

export function rulesFromDb(
  row: PublicRegistrationFieldRules | null | undefined,
): PublicRegistrationFieldRules {
  if (!row) return { ...defaultPublicFieldRules };
  return {
    requireGuardianEmail: row.requireGuardianEmail,
    requireGuardianPhone: row.requireGuardianPhone,
    requireAllergiesNotes: row.requireAllergiesNotes,
  };
}

export type PublicRegistrationParseResult =
  | { ok: true; data: PublicRegistrationParsed }
  | { ok: false; error: z.ZodError };

export type PublicChildParsed = {
  firstName: string;
  lastName: string;
  childDateOfBirth: string;
  allergiesNotes: string | null;
};

export type PublicRegistrationParsed = {
  seasonId: string;
  guardianFirstName: string;
  guardianLastName: string;
  guardianEmail?: string;
  guardianPhone?: string;
  children: PublicChildParsed[];
};

const childRowSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(100),
  lastName: z.string().trim().min(1, "Last name is required").max(100),
  childDateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date"),
  allergiesNotes: z.union([z.string().trim().max(2000), z.null()]).optional(),
});

/**
 * Validate public registration FormData using per-season required-field rules.
 * Honeypot field `company` must be empty.
 * `childrenPayload` must be JSON array of child rows (1–8).
 */
export function parsePublicRegistrationForm(
  formData: FormData,
  rules: PublicRegistrationFieldRules,
): PublicRegistrationParseResult {
  const get = (k: string) => {
    const v = formData.get(k);
    return typeof v === "string" ? v : "";
  };

  if (get("company").trim() !== "") {
    const err = new z.ZodError([
      {
        code: "custom",
        message: "Unable to submit this form.",
        path: ["company"],
      },
    ]);
    return { ok: false, error: err };
  }

  if (get("confirmedAccurate") !== "true") {
    const err = new z.ZodError([
      {
        code: "custom",
        message: "Please confirm your information is accurate before submitting.",
        path: ["confirmedAccurate"],
      },
    ]);
    return { ok: false, error: err };
  }

  let childrenRaw: unknown;
  try {
    childrenRaw = JSON.parse(get("childrenPayload") || "[]");
  } catch {
    const err = new z.ZodError([
      {
        code: "custom",
        message: "Invalid registration data. Please refresh and try again.",
        path: ["childrenPayload"],
      },
    ]);
    return { ok: false, error: err };
  }

  const childrenList = z.array(childRowSchema).min(1, "Add at least one child").max(8).safeParse(childrenRaw);
  if (!childrenList.success) {
    return { ok: false, error: childrenList.error };
  }

  const raw = {
    seasonId: get("seasonId"),
    guardianFirstName: get("guardianFirstName"),
    guardianLastName: get("guardianLastName"),
    guardianEmail: get("guardianEmail"),
    guardianPhone: get("guardianPhone"),
  };

  const baseSchema = z
    .object({
      seasonId: z.string().min(1, "Choose a VBS season"),
      guardianFirstName: z.string().trim().min(1, "Required").max(100),
      guardianLastName: z.string().trim().min(1, "Required").max(100),
      guardianEmail: z.string().trim().max(200).optional(),
      guardianPhone: z.string().trim().max(40).optional(),
    })
    .superRefine((data, ctx) => {
      if (rules.requireGuardianEmail) {
        if (!data.guardianEmail?.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Email is required for this program.",
            path: ["guardianEmail"],
          });
        }
      }
      if (data.guardianEmail?.trim()) {
        const e = z.string().email().safeParse(data.guardianEmail.trim());
        if (!e.success) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Enter a valid email address.",
            path: ["guardianEmail"],
          });
        }
      }
      if (rules.requireGuardianPhone && !data.guardianPhone?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Phone is required for this program.",
          path: ["guardianPhone"],
        });
      }
    });

  const baseParsed = baseSchema.safeParse(raw);
  if (!baseParsed.success) return { ok: false, error: baseParsed.error };

  const children: PublicChildParsed[] = [];
  for (let index = 0; index < childrenList.data.length; index++) {
    const row = childrenList.data[index];
    const notes =
      row.allergiesNotes === undefined || row.allergiesNotes === null
        ? null
        : row.allergiesNotes.trim() === ""
          ? null
          : row.allergiesNotes.trim();

    if (rules.requireAllergiesNotes && !notes) {
      const err = new z.ZodError([
        {
          code: "custom",
          message: 'Please note allergies or enter "None".',
          path: ["children", index, "allergiesNotes"],
        },
      ]);
      return { ok: false, error: err };
    }

    children.push({
      firstName: row.firstName.trim(),
      lastName: row.lastName.trim(),
      childDateOfBirth: row.childDateOfBirth,
      allergiesNotes: notes,
    });
  }

  const d = baseParsed.data;
  return {
    ok: true,
    data: {
      seasonId: d.seasonId,
      guardianFirstName: d.guardianFirstName,
      guardianLastName: d.guardianLastName,
      guardianEmail: d.guardianEmail?.trim() || undefined,
      guardianPhone: d.guardianPhone?.trim() || undefined,
      children,
    },
  };
}
