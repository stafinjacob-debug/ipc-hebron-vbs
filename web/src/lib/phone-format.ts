/** Strip to digits only, max 10 (US). */
export function phoneDigits(value: string): string {
  return value.replace(/\D/g, "").slice(0, 10);
}

/** Display mask for US phone as user types. */
export function formatPhoneInput(value: string): string {
  const d = phoneDigits(value);
  if (d.length === 0) return "";
  if (d.length <= 3) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}
