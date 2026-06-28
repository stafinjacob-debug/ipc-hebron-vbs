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
    <div className={`mx-auto mt-4 max-w-md text-center ${className}`}>
      {name ? (
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-white/70">Contact person</p>
          <p className="inline-flex items-center justify-center gap-2 text-base font-semibold leading-snug text-white sm:text-lg">
            <UserRound className="size-4 shrink-0 text-amber-200/90" aria-hidden />
            <span>{name}</span>
          </p>
        </div>
      ) : null}
      {email ? (
        <p
          className={`inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-cyan-100/95 sm:text-sm ${name ? "mt-4" : ""}`}
        >
          <Mail className="size-3.5 shrink-0" aria-hidden />
          <a href={`mailto:${email}`} className="underline decoration-cyan-100/50 underline-offset-2">
            {email}
          </a>
        </p>
      ) : null}
    </div>
  );
}
