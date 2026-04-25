import type { PublicRegistrationLayout } from "@/generated/prisma";

export function parsePublicRegistrationLayout(
  v: string | null | undefined,
): PublicRegistrationLayout {
  if (v === "SPLIT_FORM_LEFT" || v === "SPLIT_FORM_RIGHT" || v === "OVERLAY") {
    return v;
  }
  return "OVERLAY";
}
