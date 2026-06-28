"use client";

import Link from "next/link";
import { CalendarDays, Clock } from "lucide-react";
import { RegistrationPublicContactPromo } from "@/components/registration-public-contact-promo";
import { formatSeasonDateRange } from "@/lib/season-calendar-date";
import { phoneDigits } from "@/lib/phone-format";
import { RegistrationBackgroundMedia } from "../registration-background-media";
import { RegistrationHeroBrand } from "../registration-hero-brand";
import { RegistrantLookupForm } from "./registrant-lookup-form";

export type RegistrantLookupPageDisplay = {
  churchDisplayName: string;
  headerLabel: string;
  contactEmail: string;
  contactPhone: string;
  formTitle: string | null;
  seasonName: string | null;
  seasonId: string | null;
  registerPath: string | null;
  welcomeMessage: string | null;
  startDate: string | null;
  endDate: string | null;
  sessionTimeDescription: string | null;
  helpContactEmail: string | null;
  helpContactName: string | null;
  backgroundImageUrl: string | null;
  backgroundVideoUrl: string | null;
  backgroundDimmingPercent: number;
  lookupEnabled: boolean;
  registrationOpen: boolean;
};

export function RegistrantLookupPageShell({ display }: { display: RegistrantLookupPageDisplay }) {
  const effectiveContactEmail = display.helpContactEmail?.trim() || display.contactEmail.trim();
  const effectiveContactName = display.helpContactName?.trim() || "";
  const title = display.formTitle?.trim() || display.seasonName?.trim() || "Registration lookup";
  const registerHref = display.registerPath ?? "/register";
  const dateRange =
    display.startDate && display.endDate
      ? formatSeasonDateRange(display.startDate, display.endDate)
      : null;

  return (
    <div className="min-h-full bg-background">
      <header className="relative z-20 border-b border-neutral-200/80 bg-white/90 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/90">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-100">
            {display.headerLabel}
          </p>
          <Link
            href="/login"
            className="text-xs font-medium text-neutral-500 underline-offset-4 hover:text-neutral-800 hover:underline dark:text-neutral-400 dark:hover:text-neutral-200"
          >
            Staff sign in
          </Link>
        </div>
      </header>

      <div className="relative isolate min-h-[calc(100dvh-3.25rem)] px-4 pb-16 pt-8 sm:pb-12 sm:pt-10">
        <RegistrationBackgroundMedia
          videoUrl={display.backgroundVideoUrl}
          imageUrl={display.backgroundImageUrl}
          dimmingPercent={display.backgroundDimmingPercent}
          variant="fixed"
        />

        <div className="relative z-10 mx-auto w-full max-w-lg">
          <div className="rounded-3xl border border-white/10 bg-black/40 shadow-[0_20px_60px_rgba(0,0,0,0.45),0_0_48px_rgba(255,220,100,0.12)] backdrop-blur-xl">
            <div className="px-5 pt-6 text-center sm:px-8">
              <RegistrationHeroBrand churchDisplayName={display.churchDisplayName} />
              <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-brand/90">
                {display.churchDisplayName}
              </p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl">{title}</h1>

              {dateRange ? (
                <div
                  className="mx-auto mt-4 max-w-md space-y-1.5 text-center"
                  role="group"
                  aria-label="VBS dates and times"
                >
                  <p className="flex flex-wrap items-center justify-center gap-2 text-lg font-bold leading-snug text-white sm:text-xl">
                    <CalendarDays className="size-4 shrink-0 text-amber-200/90" aria-hidden />
                    <span>{dateRange}</span>
                  </p>
                  {display.sessionTimeDescription?.trim() ? (
                    <p className="flex items-start justify-center gap-2 text-sm font-semibold leading-snug text-white/95">
                      <Clock className="mt-0.5 size-3.5 shrink-0 text-cyan-200/95" aria-hidden />
                      <span className="max-w-[min(100%,22rem)] whitespace-pre-line text-left">
                        {display.sessionTimeDescription.trim()}
                      </span>
                    </p>
                  ) : null}
                </div>
              ) : null}

              <p className="mx-auto mt-3 max-w-md whitespace-pre-line text-sm leading-relaxed text-neutral-200/85">
                {display.welcomeMessage?.trim() ||
                  "View or update your registration. We’ll verify your identity with a code sent to the email on file."}
              </p>

              <RegistrationPublicContactPromo
                contactName={effectiveContactName}
                contactEmail={effectiveContactEmail}
              />

              <h2 className="mt-6 text-lg font-semibold text-white">Find your registration</h2>
            </div>

            <div className="mt-5 border-t border-white/10 px-5 py-6 sm:px-8 sm:py-7">
              {display.lookupEnabled ? (
                <div className="rounded-2xl border border-neutral-200/80 bg-white/95 p-5 shadow-sm dark:border-neutral-700 dark:bg-neutral-950/95 sm:p-6">
                  <RegistrantLookupForm seasonId={display.seasonId} />
                </div>
              ) : (
                <div className="rounded-2xl border border-amber-200/60 bg-amber-50/95 p-5 text-center text-sm text-amber-950 shadow-sm sm:p-6">
                  <p className="font-semibold">Registration lookup is not available right now.</p>
                  <p className="mt-2 text-amber-900/90">
                    Online registration may be closed for the season. Contact the church office if you need help with
                    your registration.
                  </p>
                </div>
              )}

              <p className="mt-5 text-center text-sm text-neutral-200/90">
                {display.registrationOpen ? (
                  <>
                    <Link href={registerHref} className="font-medium text-cyan-100 underline decoration-cyan-100/40">
                      Register
                    </Link>
                    {" · "}
                  </>
                ) : null}
                <Link href="/login" className="font-medium text-cyan-100 underline decoration-cyan-100/40">
                  Staff login
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>

      <footer className="relative z-20 border-t border-neutral-200/80 bg-white/80 py-6 text-center text-xs text-neutral-500 dark:border-neutral-800 dark:bg-neutral-950/80 dark:text-neutral-400">
        <p className="mx-auto max-w-md px-4">
          Secure registration — your information is used only for this VBS event.{" "}
          {effectiveContactEmail || display.contactPhone ? (
            <>
              Questions?{" "}
              {effectiveContactEmail ? (
                <a href={`mailto:${effectiveContactEmail}`} className="font-medium text-brand underline">
                  {effectiveContactEmail}
                </a>
              ) : null}
              {effectiveContactEmail && display.contactPhone ? " · " : null}
              {display.contactPhone ? (
                <a
                  href={`tel:${phoneDigits(display.contactPhone)}`}
                  className="font-medium text-brand underline"
                >
                  {display.contactPhone}
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
