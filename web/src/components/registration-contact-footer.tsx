import { phoneDigits } from "@/lib/phone-format";

export type RegistrationContactFooterProps = {
  /** When set, shown as-is instead of the auto-generated Questions? line. */
  contactFooterText?: string | null;
  contactEmail?: string;
  contactPhone?: string;
  churchDisplayName?: string;
  className?: string;
  linkClassName?: string;
};

export function RegistrationContactFooter({
  contactFooterText,
  contactEmail = "",
  contactPhone = "",
  churchDisplayName = "the church office",
  className,
  linkClassName = "font-medium text-brand underline",
}: RegistrationContactFooterProps) {
  const custom = contactFooterText?.trim();
  if (custom) {
    return <p className={className}>{custom}</p>;
  }

  const email = contactEmail.trim();
  const phone = contactPhone.trim();

  return (
    <p className={className}>
      Questions?{" "}
      {email ? (
        <a className={linkClassName} href={`mailto:${email}`}>
          {email}
        </a>
      ) : null}
      {email && phone ? " · " : null}
      {phone ? (
        <a className={linkClassName} href={`tel:${phoneDigits(phone)}`}>
          {phone}
        </a>
      ) : null}
      {!email && !phone ? `Reach out to ${churchDisplayName}.` : null}
    </p>
  );
}
