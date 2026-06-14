import { phoneDigits } from "@/lib/phone-format";

export type RegistrationContactFooterInput = {
  contactFooterText?: string | null;
  contactEmail?: string;
  contactPhone?: string;
  churchDisplayName?: string;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const linkStyle = "color:#2563eb;";

/** HTML footer matching {@link RegistrationContactFooter} on the registration portal. */
export function registrationContactFooterHtml(
  input: RegistrationContactFooterInput,
  opts?: { style?: string },
): string {
  const style = opts?.style ?? "margin:8px 0 0;font-size:13px;color:#475569;";
  const custom = input.contactFooterText?.trim();
  if (custom) {
    return `<p style="${style}">${escapeHtml(custom)}</p>`;
  }

  const email = input.contactEmail?.trim() ?? "";
  const phone = input.contactPhone?.trim() ?? "";
  const church = input.churchDisplayName?.trim() || "the church office";

  let body = "Questions? ";
  if (email) {
    body += `<a href="mailto:${escapeHtml(email)}" style="${linkStyle}">${escapeHtml(email)}</a>`;
  }
  if (email && phone) body += " · ";
  if (phone) {
    body += `<a href="tel:${phoneDigits(phone)}" style="${linkStyle}">${escapeHtml(phone)}</a>`;
  }
  if (!email && !phone) {
    body += `Reach out to ${escapeHtml(church)}.`;
  }

  return `<p style="${style}">${body}</p>`;
}

/** Contact block for cancellation emails when a custom footer replaces the help email line. */
export function registrationCancellationContactHtml(
  input: RegistrationContactFooterInput,
): string {
  const custom = input.contactFooterText?.trim();
  if (custom) {
    return `
    <p style="margin:0 0 12px;font-size:14px;line-height:1.55;color:#475569;">
      If you believe this cancellation was made in error, please contact us.
    </p>
    ${registrationContactFooterHtml(input, { style: "margin:0;font-size:14px;color:#475569;" })}
    `;
  }

  const email = input.contactEmail?.trim() ?? "";
  if (!email) {
    return registrationContactFooterHtml(input, { style: "margin:0;font-size:14px;color:#475569;" });
  }

  return `
    <p style="margin:0 0 12px;font-size:14px;line-height:1.55;color:#475569;">
      If you believe this cancellation was made in error, please contact us immediately at
      <a href="mailto:${escapeHtml(email)}" style="color:#2563eb;font-weight:600;">${escapeHtml(email)}</a>.
    </p>
  `;
}
