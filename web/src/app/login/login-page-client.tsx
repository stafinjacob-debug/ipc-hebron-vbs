"use client";

import Link from "next/link";
import { Nunito, Outfit } from "next/font/google";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Clock,
  Mail,
  Search,
  Sparkles,
  UserRound,
  Users,
} from "lucide-react";
import {
  formatAgeRangeForCard,
  type OpenPublicRegistrationSummary,
  type PublicRegistrationCardBadge,
} from "@/lib/open-public-registration-landing";
import { OrganizationLogo } from "@/components/layout/organization-logo";
import { formatSeasonDateRangeCompact } from "@/lib/season-calendar-date";
import { LoginForm } from "./login-form";
import { StaffPasswordResetForm } from "./staff-password-reset-form";

const CHURCH = "IPC Hebron";

const uiSans = Nunito({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
  adjustFontFallback: true,
});

const displayFont = Outfit({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
  adjustFontFallback: true,
});

const CARD_ACCENTS = [
  {
    strip: "from-violet-500 via-fuchsia-500 to-pink-400",
    glow: "bg-violet-400/20",
    cta: "from-violet-600 to-fuchsia-500",
    ring: "ring-violet-200/60",
  },
  {
    strip: "from-teal-500 via-cyan-500 to-sky-400",
    glow: "bg-cyan-400/20",
    cta: "from-teal-600 to-cyan-500",
    ring: "ring-cyan-200/60",
  },
  {
    strip: "from-amber-500 via-orange-400 to-rose-400",
    glow: "bg-amber-400/20",
    cta: "from-amber-600 to-orange-500",
    ring: "ring-amber-200/60",
  },
  {
    strip: "from-emerald-500 via-green-500 to-lime-400",
    glow: "bg-emerald-400/20",
    cta: "from-emerald-600 to-green-500",
    ring: "ring-emerald-200/60",
  },
] as const;

function statusBadgeUI(badge: PublicRegistrationCardBadge): { label: string; className: string } {
  switch (badge) {
    case "closing_soon":
      return {
        label: "Closing soon",
        className:
          "rounded-full border border-amber-500/45 bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-950",
      };
    case "waitlist":
      return {
        label: "Waitlist",
        className:
          "rounded-full border border-sky-500/40 bg-sky-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-950",
      };
    case "full":
      return {
        label: "Full",
        className:
          "rounded-full border border-neutral-400/50 bg-neutral-200 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-neutral-900",
      };
    default:
      return {
        label: "Open",
        className:
          "rounded-full border border-emerald-600/40 bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-950",
      };
  }
}

function displayThemeTag(theme: string | null): string | null {
  if (!theme) return null;
  const normalized = theme.trim().toLowerCase();
  if (normalized.startsWith("seed data")) return null;
  return theme;
}

function EventCard({
  season,
  index,
  reduceMotion,
}: {
  season: OpenPublicRegistrationSummary;
  index: number;
  reduceMotion: boolean;
}) {
  const accent = CARD_ACCENTS[index % CARD_ACCENTS.length];
  const badge = statusBadgeUI(season.statusBadge);
  const ageLine = formatAgeRangeForCard(season);
  const themeTag = displayThemeTag(season.theme);
  const canRegister = season.statusBadge === "open" || season.statusBadge === "closing_soon" || season.statusBadge === "waitlist";

  return (
    <li
      className={`event-card-3d ${reduceMotion ? "" : "event-card-float"}`}
      style={reduceMotion ? undefined : { animationDelay: `${index * 0.75}s` }}
    >
      <Link
        href={season.registerPath}
        className={`group relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/80 bg-white/95 shadow-[0_8px_32px_-8px_rgba(15,23,42,0.12),0_2px_8px_-2px_rgba(15,23,42,0.06)] ring-1 ${accent.ring} backdrop-blur-sm transition hover:border-white hover:shadow-[0_24px_48px_-12px_rgba(15,23,42,0.18),0_8px_24px_-8px_rgba(109,40,217,0.12)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand`}
        aria-label={`Register for ${season.name}`}
      >
        <div className={`h-1.5 w-full bg-gradient-to-r ${accent.strip}`} aria-hidden />
        <div className={`pointer-events-none absolute -right-8 -top-8 size-32 rounded-full ${accent.glow} blur-2xl`} aria-hidden />

        <div className="relative flex flex-1 flex-col p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-2">
              {themeTag ? (
                <p className="inline-flex max-w-full items-center gap-1 rounded-full border border-violet-200/70 bg-violet-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-800">
                  <Sparkles className="size-3 shrink-0 text-amber-500" aria-hidden />
                  <span className="line-clamp-1">{themeTag}</span>
                </p>
              ) : null}
              <h3 className={`${displayFont.className} text-xl font-semibold leading-tight tracking-tight text-stone-900 sm:text-[1.35rem]`}>
                {season.name}
              </h3>
              {season.formTitle && season.formTitle !== season.name ? (
                <p className="text-sm font-medium leading-snug text-stone-600">{season.formTitle}</p>
              ) : null}
            </div>
            <span className={`shrink-0 ${badge.className}`}>{badge.label}</span>
          </div>

          <div className="mt-4 space-y-2 text-sm font-medium text-stone-700">
            <p className="inline-flex items-center gap-2">
              <CalendarDays className="size-4 shrink-0 text-teal-600" aria-hidden />
              <span>{formatSeasonDateRangeCompact(season.startDateIso, season.endDateIso)}</span>
            </p>
            {season.sessionTimeDescription?.trim() ? (
              <p className="flex items-start gap-2">
                <Clock className="mt-0.5 size-4 shrink-0 text-teal-600" aria-hidden />
                <span className="min-w-0 whitespace-pre-line">{season.sessionTimeDescription.trim()}</span>
              </p>
            ) : null}
            {ageLine ? (
              <p className="inline-flex items-center gap-2">
                <Users className="size-4 shrink-0 text-fuchsia-600" aria-hidden />
                <span>{ageLine}</span>
              </p>
            ) : null}
          </div>

          {season.teaser ? (
            <p className="mt-3 line-clamp-4 flex-1 whitespace-pre-line text-sm leading-relaxed text-stone-600">
              {season.teaser}
            </p>
          ) : (
            <div className="flex-1" />
          )}

          {(season.helpContactName || season.helpContactEmail) ? (
            <div className="mt-3 space-y-1">
              {season.helpContactName ? (
                <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-stone-700">
                  <UserRound className="size-3.5 shrink-0" aria-hidden />
                  <span className="truncate">{season.helpContactName}</span>
                </p>
              ) : null}
              {season.helpContactEmail ? (
                <p className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-500">
                  <Mail className="size-3.5 shrink-0" aria-hidden />
                  <span className="truncate">{season.helpContactEmail}</span>
                </p>
              ) : null}
            </div>
          ) : null}

          <div
            className={`mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r ${accent.cta} px-4 py-3 text-sm font-semibold text-white shadow-md transition group-hover:shadow-lg group-hover:brightness-105`}
          >
            {canRegister ? "Register now" : "View details"}
            <ArrowRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden />
          </div>
        </div>
      </Link>
    </li>
  );
}

export function LoginPageClient({
  seasons,
  lookupOpen,
  dbUnavailable = false,
}: {
  seasons: OpenPublicRegistrationSummary[];
  lookupOpen: boolean;
  dbUnavailable?: boolean;
}) {
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
    <div className={`${uiSans.className} relative flex min-h-dvh flex-col text-stone-900`}>
      {/* Soft ambient background — no event-specific hero media */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
        <div className="absolute inset-0 bg-gradient-to-br from-stone-50 via-white to-teal-50/40" />
        <div className="absolute -left-1/4 top-0 h-[55vh] w-[55vw] rounded-full bg-violet-200/30 blur-3xl" />
        <div className="absolute -right-1/4 top-1/4 h-[45vh] w-[45vw] rounded-full bg-cyan-200/25 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-[40vh] w-[50vw] rounded-full bg-amber-100/35 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(120,113,108,0.08) 1px, transparent 0)`,
            backgroundSize: "28px 28px",
          }}
        />
      </div>

      <header className="relative z-10 border-b border-stone-200/60 bg-white/80 shadow-sm backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6 sm:py-5">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <OrganizationLogo
              className="h-16 w-16 shrink-0 object-contain sm:h-20 sm:w-20"
              priority
              sizes="(max-width: 640px) 64px, 80px"
            />
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-brand">{CHURCH}</p>
              <h1 className={`${displayFont.className} text-xl font-semibold tracking-tight text-stone-900 sm:text-2xl`}>
                Event Registration
              </h1>
              <p className="mt-0.5 text-sm text-stone-600">Choose an open program below to get started.</p>
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
      </header>

      {staffOpen ? (
        <div className="relative z-10 border-b border-stone-200/50 bg-white/92 px-4 py-5 shadow-sm backdrop-blur-md">
          <div className="mx-auto w-full max-w-sm">
            <p className="mb-3 text-center text-[11px] text-stone-500">Management portal — coordinators & staff</p>
            <LoginForm />
            <StaffPasswordResetForm />
            {lookupOpen ? (
              <p className="mt-4 text-center text-sm text-stone-600">
                Already registered?{" "}
                <Link href="/register/lookup" className="font-semibold text-brand underline">
                  Look up or edit your registration
                </Link>
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      <main className="relative z-10 mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        {dbUnavailable ? (
          <div className="mx-auto max-w-lg rounded-2xl border border-amber-200/80 bg-white/95 p-6 text-center shadow-lg sm:p-8">
            <Sparkles className="mx-auto size-10 text-amber-600" aria-hidden />
            <h2 className="mt-4 text-lg font-semibold text-stone-900">Cannot reach the registration database</h2>
            <p className="mt-2 text-sm leading-relaxed text-stone-700">
              The site is running but could not connect to the database. If you use Azure PostgreSQL, check firewall
              rules or your <code className="text-xs">DATABASE_URL</code> configuration.
            </p>
            {(contactEmail || contactPhone) && (
              <p className="mt-3 text-sm text-stone-600">
                For help: {contactEmail}
                {contactEmail && contactPhone ? " · " : ""}
                {contactPhone}
              </p>
            )}
          </div>
        ) : seasons.length === 0 ? (
          <div className="mx-auto max-w-lg rounded-2xl border border-stone-200/60 bg-white/95 p-6 text-center shadow-lg sm:p-8">
            <Sparkles className="mx-auto size-10 text-brand" aria-hidden />
            <h2 className="mt-4 text-lg font-semibold text-stone-900">
              {lookupOpen ? "Registration is now closed" : "No events open right now"}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-stone-700">
              {lookupOpen
                ? "We are no longer accepting new signups, but you can still look up or update an existing registration."
                : "When a program is published and accepting responses, it will appear here. Check back soon."}
            </p>
            {lookupOpen ? (
              <Link
                href="/register/lookup"
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-stone-900 px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
              >
                <Search className="size-4" aria-hidden />
                Look up your registration
              </Link>
            ) : null}
          </div>
        ) : (
          <div style={{ perspective: "1200px" }}>
            <div className="mb-8 text-center sm:mb-10">
              <h2 className={`${displayFont.className} text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl`}>
                Open programs
              </h2>
              <p className="mx-auto mt-2 max-w-xl text-sm text-stone-600 sm:text-base">
                Select an event to register. Each program has its own secure signup form — takes about 2–3 minutes.
              </p>
            </div>

            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
              {seasons.map((s, i) => (
                <EventCard key={s.id} season={s} index={i} reduceMotion={reduceMotion} />
              ))}
            </ul>

            {lookupOpen ? (
              <div className="mt-10 text-center">
                <Link
                  href="/register/lookup"
                  className="inline-flex items-center gap-2 rounded-full border border-stone-300/80 bg-white/90 px-5 py-2.5 text-sm font-semibold text-stone-700 shadow-sm transition hover:border-brand/40 hover:text-brand"
                >
                  <Search className="size-4" aria-hidden />
                  Already registered? Look up or edit your registration
                </Link>
              </div>
            ) : null}
          </div>
        )}
      </main>

      <footer className="relative z-10 border-t border-stone-200/55 bg-white/85 px-4 py-6 text-center text-xs text-stone-600 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:text-left">
          <p>{CHURCH} — secure online registration</p>
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
                  <a
                    href={`tel:${contactPhone.replace(/\D/g, "")}`}
                    className="font-medium text-brand underline underline-offset-2"
                  >
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
