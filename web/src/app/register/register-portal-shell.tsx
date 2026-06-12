import Link from "next/link";
import type { PortalBranding } from "@/lib/portal-branding";

export function RegisterPortalShell({
  branding,
  children,
  dbUnavailable = false,
}: {
  branding: PortalBranding;
  children: React.ReactNode;
  dbUnavailable?: boolean;
}) {
  const { contactEmail, contactPhone, footerNote, headerLabel } = branding;

  return (
    <div className="min-h-full bg-background">
      <header className="border-b border-neutral-200/80 bg-white/90 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/90">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-100">{headerLabel}</p>
          <Link
            href="/login"
            className="text-xs font-medium text-neutral-500 underline-offset-4 hover:text-neutral-800 hover:underline dark:text-neutral-400 dark:hover:text-neutral-200"
          >
            Staff sign in
          </Link>
        </div>
      </header>

      <div className="px-4 pb-16 pt-8 sm:pb-12 sm:pt-10">
        {dbUnavailable ? (
          <div className="mx-auto mb-4 max-w-6xl rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
            Registration is temporarily unavailable because the database connection timed out. Please try again in a
            minute.
          </div>
        ) : null}
        {children}
      </div>

      <footer className="border-t border-neutral-200/80 bg-white/80 py-6 text-center text-xs text-neutral-500 dark:border-neutral-800 dark:bg-neutral-950/80 dark:text-neutral-400">
        <p className="mx-auto max-w-md px-4">
          {footerNote}{" "}
          {contactEmail || contactPhone ? (
            <>
              Questions?{" "}
              {contactEmail ? (
                <a href={`mailto:${contactEmail}`} className="font-medium text-brand underline">
                  {contactEmail}
                </a>
              ) : null}
              {contactEmail && contactPhone ? " · " : null}
              {contactPhone ? (
                <a href={`tel:${contactPhone.replace(/\D/g, "")}`} className="font-medium text-brand underline">
                  {contactPhone}
                </a>
              ) : null}
            </>
          ) : (
            <>Contact the church office for assistance.</>
          )}
        </p>
      </footer>
    </div>
  );
}
