/** Default overlay strength (matches previous Tailwind `neutral-950/60`). */
export const DEFAULT_REGISTRATION_BACKGROUND_DIMMING_PERCENT = 60;

/** Clamp 0–100 for `PublicRegistrationSettings.registrationBackgroundDimmingPercent`. */
export function clampRegistrationBackgroundDimmingPercent(value: unknown): number {
  const n = typeof value === "number" ? value : parseInt(String(value ?? "").trim(), 10);
  if (!Number.isFinite(n)) return DEFAULT_REGISTRATION_BACKGROUND_DIMMING_PERCENT;
  return Math.min(100, Math.max(0, Math.round(n)));
}
