import { Mail, UserRound } from "lucide-react";

/** Contact person + email shown under the welcome text on public registration pages. */
export function RegistrationPublicContactPromo({
  contactName,
  contactEmail,
  className = "",
}: {
  contactName?: string | null;
  contactEmail?: string | null;
  className?: string;
}) {
  const name = contactName?.trim() || "";
  const email = contactEmail?.trim() || "";
  if (!name && !email) return null;

  return (
    <div className={`mx-auto mt-4 max-w-md space-y-1.5 text-center ${className}`}>
      {name ? (
        <p className="inline-flex items-center justify-center gap-2 text-base font-semibold leading-snug text-white sm:text-lg">
          <UserRound className="size-4 shrink-0 text-amber-200/90" aria-hidden />
          <span>{name}</span>
        </p>
      ) : null}
      {email ? (
        <p className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-cyan-100/95 sm:text-sm">
          <Mail className="size-3.5 shrink-0" aria-hidden />
          <a href={`mailto:${email}`} className="underline decoration-cyan-100/50 underline-offset-2">
            {email}
          </a>
        </p>
      ) : null}
    </div>
  );
}
