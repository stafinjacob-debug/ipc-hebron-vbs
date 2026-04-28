"use client";

import Link from "next/link";
import { Fredoka, Nunito } from "next/font/google";
import { useCallback, useEffect, useState } from "react";
import { CalendarDays, ChevronDown, ChevronUp, Clock, Mail, Sparkles, UserRound, Users } from "lucide-react";
import {
  formatAgeRangeForCard,
  type OpenPublicRegistrationSummary,
  type PublicRegistrationCardBadge,
} from "@/lib/open-public-registration-landing";
import { OrganizationLogo } from "@/components/layout/organization-logo";
import { LoginForm } from "./login-form";

const CHURCH = "IPC Hebron";
const BACKDROP_VIDEO_SRC = "/VBS_backdrop.mp4";

/** Rounded, readable UI — pairs with display headings to echo VBS-style lettering. */
const loginCardSans = Nunito({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
  adjustFontFallback: true,
});

/** Soft, rounded display — closer to the playful hero type on the backdrop video. */
const loginCardDisplay = Fredoka({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
  adjustFontFallback: true,
});

function formatCampDates(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  const opts: Intl.DateTimeFormatOptions = { month: "long", day: "numeric", year: "numeric" };
  if (sameMonth) {
    return `${start.toLocaleDateString(undefined, { month: "long", day: "numeric" })} – ${end.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}`;
  }
  return `${start.toLocaleDateString(undefined, opts)} – ${end.toLocaleDateString(undefined, opts)}`;
}

/** Badges stay high-contrast on the frosted card (no `dark:` flip — OS dark mode was washing out “Open”). */
function statusBadgeUI(badge: PublicRegistrationCardBadge): { label: string; className: string } {
  switch (badge) {
    case "closing_soon":
      return {
        label: "Closing soon",
        className:
          "rounded-full border border-amber-500/45 bg-amber-100 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-amber-950 shadow-sm",
      };
    case "waitlist":
      return {
        label: "Waitlist",
        className:
          "rounded-full border border-sky-500/40 bg-sky-100 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-sky-950 shadow-sm",
      };
    case "full":
      return {
        label: "Full",
        className:
          "rounded-full border border-neutral-400/50 bg-neutral-200 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-neutral-900 shadow-sm",
      };
    default:
      return {
        label: "Open",
        className:
          "rounded-full border border-emerald-600/40 bg-emerald-100 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-emerald-950 shadow-sm",
      };
  }
}

function primaryCtaLabel(seasons: OpenPublicRegistrationSummary[]): string {
  if (seasons.length === 1) return `Register for ${seasons[0].name}`;
  if (seasons.length > 1) return "Register for VBS";
  return "Go to registration";
}

function displayThemeTag(theme: string | null): string | null {
  if (!theme) return null;
  const normalized = theme.trim().toLowerCase();
  if (normalized.startsWith("seed data")) return null;
  return theme;
}

export function LoginPageClient({ seasons }: { seasons: OpenPublicRegistrationSummary[] }) {
  const [staffOpen, setStaffOpen] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const toggleStaff = useCallback(() => setStaffOpen((o) => !o), []);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduceMotion(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const contactEmail = process.env.NEXT_PUBLIC_VBS_CONTACT_EMAIL?.trim() ?? "";
  const contactPhone = process.env.NEXT_PUBLIC_VBS_CONTACT_PHONE?.trim() ?? "";

  return (
    <div className="relative flex min-h-dvh flex-col bg-transparent text-stone-900">
      <div className="pointer-events-none fixed inset-0 z-0" aria-hidden>
        {/* Video + scrim: full width on small screens; on lg+ only the area left of the registration rail */}
        <div className="absolute inset-0 lg:inset-y-0 lg:left-0 lg:top-0 lg:w-[calc(100%-min(28rem,36vw))]">
          {reduceMotion ? (
            <div className="h-full w-full bg-gradient-to-br from-brand/20 via-background to-brand/10" />
          ) : (
            <video
              className="h-full w-full object-cover object-[55%_center] [transform:translateZ(0)] lg:object-center"
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              aria-hidden
            >
              <source src={BACKDROP_VIDEO_SRC} type="video/mp4" />
            </video>
          )}
          {/* Light gray / warm-white mist over the video — keeps art visible without a heavy black wash */}
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(180deg,
                color-mix(in srgb, var(--background) 86%, transparent) 0%,
                color-mix(in srgb, var(--background) 32%, transparent) 18%,
                rgba(255, 255, 255, 0.08) 36%,
                rgba(255, 255, 255, 0.06) 52%,
                rgba(250, 250, 249, 0.28) 78%,
                rgba(252, 252, 251, 0.42) 100%)`,
            }}
            aria-hidden
          />
          <div
            className="absolute inset-0 bg-gradient-to-b from-white/[0.12] via-transparent to-stone-100/[0.22] dark:from-white/[0.06] dark:via-white/[0.02] dark:to-stone-200/[0.12]"
            aria-hidden
          />
        </div>
        {/* Desktop: solid rail — full-height panel so the registration card reads grounded (not floating over the cut). */}
        <div
          className="absolute inset-y-0 right-0 hidden w-[min(28rem,36vw)] border-l border-stone-200/60 bg-white/92 shadow-[inset_1px_0_0_rgba(255,255,255,0.85)] dark:border-stone-200/55 dark:bg-white/90 lg:block"
          aria-hidden
        />
        {/* Soften the video’s right edge where it meets the rail (avoids a harsh vertical seam). */}
        <div
          className="pointer-events-none absolute inset-y-0 right-[min(28rem,36vw)] hidden w-20 bg-gradient-to-l from-white to-transparent dark:from-white lg:block"
          aria-hidden
        />
      </div>

      <header className="relative z-10 isolate overflow-hidden border-b border-stone-200/55 bg-white/90 shadow-sm backdrop-blur-md dark:border-stone-300/45 dark:bg-white/90">
        {/* Quiet brand presence: soft color wash so the accent feels integrated, not floating */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-16 sm:h-20"
          style={{
            background: `
              radial-gradient(ellipse 58% 130% at 16% -25%, rgba(217, 45, 32, 0.1), transparent 58%),
              radial-gradient(ellipse 52% 110% at 86% -18%, rgba(26, 86, 168, 0.09), transparent 56%),
              radial-gradient(ellipse 48% 90% at 50% -30%, rgba(45, 138, 84, 0.05), transparent 52%)
            `,
          }}
          aria-hidden
        />
        <div className="relative mx-auto max-w-6xl px-4 pb-3 pt-3 sm:px-6 sm:pb-3.5 sm:pt-3.5">
          {/* Single muted gradient bar (red → orange → green → blue); low contrast vs hero */}
          <div className="mb-3 sm:mb-3.5" aria-hidden>
            <div
              className="h-[2px] w-full rounded-full sm:h-[3px]"
              style={{
                opacity: 0.66,
                filter: "blur(0.35px)",
                background:
                  "linear-gradient(90deg, #e84848 0%, #f0a04a 32%, #3bc489 66%, #3a9fe8 100%)",
                boxShadow:
                  "0 0 10px rgba(232, 72, 72, 0.12), 0 0 14px rgba(58, 159, 232, 0.08), inset 0 1px 0 rgba(255,255,255,0.35)",
              }}
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3 pr-1 sm:gap-4">
              <OrganizationLogo
                className="h-28 w-28 shrink-0 object-contain sm:h-36 sm:w-36"
                priority
                sizes="(max-width: 640px) 112px, 144px"
              />
              <div className="min-w-0">
                <h1 className="text-xl font-semibold tracking-tight text-stone-900 [text-shadow:0_1px_0_rgba(255,255,255,0.9)] sm:text-2xl">
                  Vacation Bible School
                </h1>
                <p className="mt-1 text-sm leading-snug text-stone-800 sm:text-[0.9375rem]">
                  Register your children for this year&apos;s VBS programs.
                </p>
                <p className="mt-1 text-xs font-medium leading-snug text-stone-700 sm:text-sm">
                  Choose a program below to begin your secure registration.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={toggleStaff}
              className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-stone-500 underline-offset-4 transition hover:text-stone-700 hover:underline"
              aria-expanded={staffOpen}
            >
              {staffOpen ? (
                <span className="inline-flex items-center gap-0.5">
                  Close <ChevronUp className="size-3 opacity-70" aria-hidden />
                </span>
              ) : (
                <span className="inline-flex items-center gap-0.5">
                  Staff <ChevronDown className="size-3 opacity-70" aria-hidden />
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {staffOpen ? (
        <div className="relative z-10 border-b border-stone-200/50 bg-white/92 px-4 py-5 shadow-sm backdrop-blur-md dark:bg-white/92">
          <div className="mx-auto w-full max-w-sm">
            <p className="mb-3 text-center text-[11px] text-stone-500">Management portal — coordinators & staff</p>
            <LoginForm />
          </div>
        </div>
      ) : null}

      <main
        className={
          seasons.length === 0
            ? "relative z-10 mx-auto w-full max-w-lg flex-1 px-4 pb-8 pt-6 sm:pt-8"
            : "relative z-10 mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 px-4 pb-8 pt-4 sm:px-5 sm:pt-5 lg:max-w-none lg:grid-cols-[1fr_min(28rem,36vw)] lg:px-0 lg:pb-10 lg:pt-5"
        }
      >
        {seasons.length === 0 ? (
          <div className="rounded-2xl border border-stone-200/60 bg-white/92 p-6 text-center shadow-lg ring-1 ring-stone-900/[0.04] backdrop-blur-md dark:bg-white/92 sm:p-8">
            <Sparkles className="mx-auto size-10 text-brand" aria-hidden />
            <h2 className="mt-4 text-lg font-semibold text-stone-900">Registration is not open yet</h2>
            <p className="mt-2 text-sm leading-relaxed text-stone-700">
              When a program is published and accepting responses, it will appear here. Check back soon, or contact the
              church office.
            </p>
            <Link
              href="/register"
              className="mt-6 inline-flex rounded-xl bg-stone-900 px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
            >
              Try registration page
            </Link>
          </div>
        ) : (
          <>
            {/* Mobile: breathing room above the card over the video */}
            <div className="pointer-events-none min-h-[min(26vh,200px)] w-full lg:hidden" aria-hidden />
            {/* Desktop: first grid column — lets the hero media read as one continuous band */}
            <div className="hidden min-h-0 lg:block" aria-hidden />

            <div className="flex min-h-0 w-full flex-col justify-center space-y-0 px-4 pb-2 sm:px-5 lg:col-start-2 lg:px-6 lg:pb-0 xl:px-8">
              <div
                className={`${loginCardSans.className} relative overflow-hidden rounded-[1.75rem] border border-white/70 shadow-[0_16px_56px_-12px_rgba(15,23,42,0.12),0_28px_56px_-24px_rgba(109,40,217,0.1),inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-lg dark:border-white/65 dark:shadow-[0_16px_48px_-14px_rgba(15,23,42,0.14),inset_0_1px_0_rgba(255,255,255,0.88)]`}
              >
                {/* Event palette strip — ties card to hero art without overwhelming */}
                <div
                  className="h-1.5 w-full bg-gradient-to-r from-violet-600 via-fuchsia-500 to-teal-500 sm:h-2"
                  aria-hidden
                />
                <div className="pointer-events-none absolute -right-10 top-8 size-36 rounded-full bg-fuchsia-400/18 blur-3xl dark:bg-fuchsia-400/16" aria-hidden />
                <div className="pointer-events-none absolute -bottom-8 -left-6 size-32 rounded-full bg-cyan-400/16 blur-3xl dark:bg-cyan-400/14" aria-hidden />
                <div className="pointer-events-none absolute right-6 top-20 size-16 rounded-full bg-amber-300/24 blur-2xl dark:bg-amber-300/20" aria-hidden />

                <div className="relative bg-gradient-to-br from-white/72 via-violet-50/35 to-teal-50/40 px-5 pb-5 pt-4 sm:px-6 sm:pb-6 sm:pt-5 dark:from-white/68 dark:via-violet-50/32 dark:to-teal-50/36">
                  <h2
                    className={`${loginCardDisplay.className} text-center text-xs font-bold uppercase tracking-[0.22em] text-violet-800 antialiased drop-shadow-sm lg:text-left`}
                  >
                    Programs open now
                  </h2>
                  <div
                    className="mx-auto mt-3 h-px max-w-[12rem] bg-gradient-to-r from-transparent via-fuchsia-400/50 to-transparent lg:mx-0"
                    aria-hidden
                  />

                  <ul className="mt-5 space-y-4">
                    {seasons.map((s) => {
                      const badge = statusBadgeUI(s.statusBadge);
                      const ageLine = formatAgeRangeForCard(s);
                      const themeTag = displayThemeTag(s.theme);
                      return (
                        <li key={s.id}>
                          <div className="rounded-2xl border border-white/70 bg-white/55 p-4 ring-1 ring-inset ring-white/55 transition [box-shadow:inset_0_1px_0_rgba(255,255,255,0.75)] hover:border-violet-300/55 hover:bg-white/70 dark:border-white/65 dark:bg-white/50 dark:ring-white/50 dark:hover:border-violet-300/50 dark:hover:bg-white/62 sm:rounded-[1.35rem] sm:p-5">
                            <div className="flex min-w-0 flex-col gap-3">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0 flex-1 space-y-3">
                                    {themeTag ? (
                                      <p className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-violet-300/55 bg-gradient-to-r from-violet-500/12 to-fuchsia-500/10 px-2.5 py-1 text-[11px] font-semibold leading-snug text-violet-900 shadow-sm">
                                        <Sparkles className="size-3.5 shrink-0 text-amber-600" aria-hidden />
                                        <span className="line-clamp-2">{themeTag}</span>
                                      </p>
                                    ) : null}
                                    <div className="flex flex-wrap items-end gap-x-2 gap-y-1">
                                      <h3
                                        className={`${loginCardDisplay.className} text-xl font-semibold tracking-wide text-neutral-950 antialiased [text-shadow:0_1px_0_rgba(255,255,255,0.95)] sm:text-2xl`}
                                      >
                                        {s.name}
                                      </h3>
                                      <span className="pb-0.5 text-sm font-semibold text-violet-700/90">
                                        ({s.year})
                                      </span>
                                    </div>
                                    {s.formTitle ? (
                                      <p className="border-b border-violet-200/55 pb-2 text-sm font-semibold leading-snug text-neutral-900">
                                        {s.formTitle}
                                      </p>
                                    ) : null}
                                    <div className="flex flex-col gap-2.5 text-sm font-medium text-neutral-800 dark:text-neutral-800">
                                      <p className="inline-flex items-center gap-2">
                                        <CalendarDays className="size-4 shrink-0 text-teal-600" aria-hidden />
                                        <span>{formatCampDates(s.startDateIso, s.endDateIso)}</span>
                                      </p>
                                      {s.sessionTimeDescription?.trim() ? (
                                        <p className="flex items-start gap-2">
                                          <Clock className="mt-0.5 size-4 shrink-0 text-teal-600" aria-hidden />
                                          <span className="min-w-0 whitespace-pre-line">
                                            {s.sessionTimeDescription.trim()}
                                          </span>
                                        </p>
                                      ) : null}
                                      {ageLine ? (
                                        <p className="inline-flex items-center gap-2">
                                          <Users className="size-4 shrink-0 text-fuchsia-600" aria-hidden />
                                          <span>{ageLine}</span>
                                        </p>
                                      ) : null}
                                    </div>
                                    {s.teaser ? (
                                      <p className="line-clamp-3 text-sm font-medium leading-relaxed text-neutral-700">
                                        {s.teaser}
                                      </p>
                                    ) : null}
                                  {s.helpContactEmail ? (
                                    <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-700">
                                      <Mail className="size-3.5 shrink-0 text-sky-600/90" aria-hidden />
                                      <a
                                        href={`mailto:${s.helpContactEmail}`}
                                        className="underline decoration-sky-600/50 underline-offset-2 hover:text-sky-700"
                                      >
                                        {s.helpContactEmail}
                                      </a>
                                    </p>
                                  ) : null}
                                  <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-600">
                                    <UserRound className="size-3.5 shrink-0 text-teal-600/85" aria-hidden />
                                    One short form per family.
                                  </p>
                                </div>
                                <span className={`shrink-0 ${badge.className}`}>{badge.label}</span>
                              </div>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>

                  <div className="mt-6 space-y-3 pt-5">
                    <div
                      className="h-px w-full bg-gradient-to-r from-transparent via-violet-300/55 to-transparent"
                      aria-hidden
                    />
                    <Link
                      href="/register"
                      className={`${loginCardDisplay.className} flex w-full items-center justify-center rounded-[1.15rem] bg-gradient-to-r from-teal-700 via-teal-600 to-cyan-500 px-5 py-4 text-center text-lg font-semibold tracking-wide text-white shadow-[0_8px_28px_-6px_rgba(13,148,136,0.55),0_2px_10px_-2px_rgba(124,58,237,0.2)] ring-2 ring-white/70 ring-offset-2 ring-offset-transparent transition hover:from-teal-600 hover:via-teal-500 hover:to-cyan-400 hover:shadow-[0_12px_32px_-6px_rgba(13,148,136,0.5),0_0_0_1px_rgba(255,255,255,0.35)_inset] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fuchsia-400/90 active:scale-[0.99]`}
                    >
                      {primaryCtaLabel(seasons)}
                    </Link>
                    <ul className="space-y-1.5 text-center text-[11px] font-medium leading-relaxed text-neutral-600 antialiased">
                      <li>Registration takes about 2–3 minutes.</li>
                      <li>One form per family.</li>
                      <li>Secure, private signup.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </main>

      <footer className="relative z-10 border-t border-stone-200/55 bg-white/90 px-4 py-6 text-center text-xs text-stone-600 shadow-[0_-8px_32px_-8px_rgba(15,23,42,0.06)] backdrop-blur-md dark:border-stone-300/45 dark:bg-white/90 dark:text-stone-600">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:text-left">
          <p className="text-stone-600">{CHURCH} VBS — secure online registration</p>
          <div className="flex flex-col items-center gap-2 sm:items-end">
            {contactEmail || contactPhone ? (
              <p>
                <span className="text-stone-500">Questions? </span>
                {contactEmail ? (
                  <a href={`mailto:${contactEmail}`} className="font-medium text-brand underline underline-offset-2">
                    {contactEmail}
                  </a>
                ) : null}
                {contactEmail && contactPhone ? <span className="text-stone-400"> · </span> : null}
                {contactPhone ? (
                  <a href={`tel:${contactPhone.replace(/\D/g, "")}`} className="font-medium text-brand underline underline-offset-2">
                    {contactPhone}
                  </a>
                ) : null}
              </p>
            ) : (
              <p className="text-stone-500">Contact the church office for help.</p>
            )}
            {!staffOpen ? (
              <button
                type="button"
                onClick={toggleStaff}
                className="text-[10px] font-medium uppercase tracking-wide text-stone-500 underline-offset-4 hover:text-stone-700 hover:underline"
              >
                Staff sign in
              </button>
            ) : null}
          </div>
        </div>
      </footer>
    </div>
  );
}
