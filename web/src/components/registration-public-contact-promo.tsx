import { Mail, Phone, UserRound } from "lucide-react";
import { phoneDigits } from "@/lib/phone-format";

type ContactLine = { name: string; phone: string | null };

/** Split "Name 405-824-1231" / "Name · 405-824-1231" / plain name lines. */
function parseContactLines(raw: string): ContactLine[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const phoneMatch = line.match(
        /^(.*?)(?:\s*[·•|,]\s*|\s+)(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})\s*$/,
      );
      if (phoneMatch) {
        const name = phoneMatch[1].trim().replace(/[·•|,]+$/, "").trim();
        const phone = phoneMatch[2].trim();
        if (name) return { name, phone };
      }
      return { name: line, phone: null };
    });
}

/** Contact person(s) + email shown under the welcome text on public registration pages. */
export function RegistrationPublicContactPromo({
  contactName,
  contactEmail,
  className = "",
}: {
  contactName?: string | null;
  contactEmail?: string | null;
  className?: string;
}) {
  const lines = parseContactLines(contactName?.trim() || "");
  const email = contactEmail?.trim() || "";
  if (lines.length === 0 && !email) return null;

  const heading = lines.length > 1 ? "Contact persons" : "Contact person";

  return (
    <div className={`mx-auto mt-4 max-w-md text-center ${className}`}>
      {lines.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-white/70">{heading}</p>
          <ul className="space-y-2">
            {lines.map((line) => {
              const digits = line.phone ? phoneDigits(line.phone) : "";
              return (
                <li
                  key={`${line.name}-${line.phone ?? ""}`}
                  className="text-base font-semibold leading-snug text-white sm:text-lg"
                >
                  <span className="inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
                    <UserRound className="size-4 shrink-0 text-amber-200/90" aria-hidden />
                    <span>{line.name}</span>
                    {line.phone && digits.length >= 10 ? (
                      <a
                        href={`tel:${digits}`}
                        className="inline-flex items-center gap-1 text-sm font-semibold text-cyan-100/95 underline decoration-cyan-100/40 underline-offset-2 sm:text-base"
                      >
                        <Phone className="size-3.5 shrink-0" aria-hidden />
                        {line.phone}
                      </a>
                    ) : line.phone ? (
                      <span className="text-sm font-semibold text-cyan-100/95 sm:text-base">{line.phone}</span>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
      {email ? (
        <p
          className={`inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-cyan-100/95 sm:text-sm ${lines.length > 0 ? "mt-4" : ""}`}
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
