import { z } from "zod";

const emptyToUndef = (v: unknown) =>
  v === "" || v === undefined || v === null ? undefined : v;

export const vbsRegistrationFormSchema = z.object({
  seasonId: z.string().min(1, "Choose a VBS season"),
  classroomId: z.preprocess(emptyToUndef, z.string().min(1).optional()),
  guardianFirstName: z.string().trim().min(1, "Required").max(100),
  guardianLastName: z.string().trim().min(1, "Required").max(100),
  guardianEmail: z.preprocess(
    emptyToUndef,
    z.string().email("Invalid email").optional(),
  ),
  guardianPhone: z.preprocess(
    emptyToUndef,
    z.string().trim().max(40).optional(),
  ),
  childFirstName: z.string().trim().min(1, "Required").max(100),
  childLastName: z.string().trim().min(1, "Required").max(100),
  childDateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
  allergiesNotes: z.preprocess(
    emptyToUndef,
    z.string().trim().max(2000).optional(),
  ),
  status: z.enum(["PENDING", "CONFIRMED", "WAITLIST"]),
  notes: z.preprocess(emptyToUndef, z.string().trim().max(2000).optional()),
});

export type VbsRegistrationFormInput = z.infer<typeof vbsRegistrationFormSchema>;

export function parseLocalDate(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map((n) => Number(n));
  if (!y || !m || !d) throw new Error("Invalid date");
  return new Date(y, m - 1, d);
}
