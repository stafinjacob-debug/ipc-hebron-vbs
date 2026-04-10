/** Default dimming slider (0–100) for new / unset values. */
export const DEFAULT_REGISTRATION_BACKGROUND_DIMMING_PERCENT = 48;

/**
 * Maps stored dimming percent (0–100) to overlay rgba alpha.
 * Capped and scaled so the background photo stays readable; avoids “invisible”
 * backgrounds that happen with literal 0.6+ alpha plus heavy backdrop blur.
 */
export function registrationBackgroundScrimAlpha(percent: number): number {
  const p = Math.min(100, Math.max(0, percent));
  return Math.min(0.5, (p / 100) * 0.72);
}

/** Clamp 0–100 for `PublicRegistrationSettings.registrationBackgroundDimmingPercent`. */
export function clampRegistrationBackgroundDimmingPercent(value: unknown): number {
  const n = typeof value === "number" ? value : parseInt(String(value ?? "").trim(), 10);
  if (!Number.isFinite(n)) return DEFAULT_REGISTRATION_BACKGROUND_DIMMING_PERCENT;
  return Math.min(100, Math.max(0, Math.round(n)));
}
