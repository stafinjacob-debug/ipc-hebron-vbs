import Link from "next/link";
import {
  ClipboardCheck,
  Home,
  Lightbulb,
  Mail,
  Sparkles,
  Ticket,
} from "lucide-react";

type RegisterThanksViewProps = {
  paid: boolean;
  /** Registration reference shown on the “ticket”. */
  code: string;
  /** VBS season display name when available (personalizes headline). */
  seasonName: string | null;
  contactEmail: string;
};

function GlowBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="absolute -top-24 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(253,224,71,0.22)_0%,transparent_68%)] blur-2xl" />
      <div className="absolute top-1/3 -right-20 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(34,211,238,0.14)_0%,transparent_70%)] blur-3xl" />
      <div className="absolute bottom-0 -left-16 h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(167,139,250,0.12)_0%,transparent_72%)] blur-3xl" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_-10%,rgba(255,255,255,0.08),transparent_50%)]" />
    </div>
  );
}

function FloatingSparkles() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl" aria-hidden>
      <Sparkles className="absolute right-[12%] top-8 size-5 text-amber-200/40 animate-pulse" />
      <Sparkles className="absolute left-[10%] top-24 size-4 text-cyan-200/35 delay-150 animate-pulse" />
      <Sparkles className="absolute bottom-20 right-[18%] size-3 text-amber-100/30 delay-300 animate-pulse" />
    </div>
  );
}

export function RegisterThanksView({ paid, code, seasonName, contactEmail }: RegisterThanksViewProps) {
  const themeLabel = seasonName?.trim() || "VBS";
  const paidHeadline = seasonName?.trim()
    ? `You're In! Welcome to ${seasonName.trim()}!`
    : "You're In! Your Light Is Shining Bright!";
  const paidLead =
    "Awesome! Your spot is secured. We can't wait to see your family — fun, games, and discovering who Jesus really is are ahead.";

  return (
    <div className="relative min-h-dvh overflow-hidden bg-[#070b10] text-neutral-100">
      <GlowBackdrop />

      <div className="relative z-10 mx-auto max-w-lg px-4 py-10 sm:py-14">
        <div
          className={[
            "relative overflow-hidden rounded-3xl border px-6 py-10 text-center shadow-2xl sm:px-8 sm:py-12",
            "border-cyan-400/25 bg-neutral-950/75 shadow-[0_0_48px_rgba(255,230,100,0.12),0_25px_50px_-12px_rgba(0,0,0,0.55)]",
            "backdrop-blur-xl",
          ].join(" ")}
        >
          <FloatingSparkles />

          <div className="relative mx-auto flex size-20 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-300/25 via-cyan-400/15 to-violet-500/20 ring-2 ring-amber-200/20 ring-offset-4 ring-offset-[#0a1018]">
            <div className="absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.35),transparent_55%)] opacity-80" />
            <div className="relative flex items-center justify-center gap-0.5">
              <Lightbulb className="size-9 text-amber-100 drop-shadow-[0_0_12px_rgba(253,224,71,0.55)]" aria-hidden />
            </div>
          </div>

          {paid ? (
            <>
              <h1 className="mt-6 text-balance text-2xl font-extrabold tracking-tight sm:text-3xl">
                <span className="bg-gradient-to-r from-amber-100 via-white to-cyan-100 bg-clip-text text-transparent">
                  {paidHeadline}
                </span>
              </h1>
              <p className="mt-4 text-pretty text-base leading-relaxed text-neutral-200/95">{paidLead}</p>
              <p className="mt-3 text-sm font-medium text-amber-100/85">
                Get ready for {themeLabel} — we&apos;re cheering for you!{" "}
                <span className="inline-block" aria-hidden>
                  💛
                </span>
              </p>

              <div className="mt-8">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-cyan-200/90">
                  Your check-in code
                </p>
                <div
                  className="mx-auto mt-2 inline-flex max-w-full items-center justify-center rounded-xl border border-dashed border-emerald-400/45 bg-emerald-400/10 px-5 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                  title="Bring this code to check-in or include it in emails to the church office."
                >
                  <Ticket className="mr-2 size-4 shrink-0 text-emerald-300/90" aria-hidden />
                  <span className="font-mono text-lg font-bold tracking-[0.2em] text-emerald-50 sm:text-xl">
                    {code}
                  </span>
                </div>
              </div>

              <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-5 text-left sm:px-5">
                <p className="text-center text-xs font-bold uppercase tracking-wide text-neutral-400">
                  What happens next
                </p>
                <ul className="mt-4 space-y-3.5 text-sm text-neutral-200/95">
                  <li className="flex gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sky-500/15 text-sky-200">
                      <Mail className="size-4" aria-hidden />
                    </span>
                    <span>
                      <span className="font-semibold text-white">Confirmation email</span> — headed to your inbox
                      soon. If you don&apos;t see it, check spam.
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 text-violet-200">
                      <ClipboardCheck className="size-4" aria-hidden />
                    </span>
                    <span>
                      <span className="font-semibold text-white">Staff review</span> — our team will look over your
                      registration to make sure everything looks great.
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-100">
                      <Ticket className="size-4" aria-hidden />
                    </span>
                    <span>
                      <span className="font-semibold text-white">Check-in details</span> — we&apos;ll follow up with
                      anything you need before the first day.
                    </span>
                  </li>
                </ul>
              </div>

              <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
                <Link
                  href="/login"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-teal-400 via-cyan-400 to-sky-500 px-6 text-base font-semibold text-neutral-950 shadow-lg shadow-cyan-500/20 transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
                >
                  <Home className="size-4 shrink-0" aria-hidden />
                  Back to home
                </Link>
                {contactEmail ? (
                  <Link
                    href={`mailto:${contactEmail}?subject=${encodeURIComponent(`${themeLabel} — registration`)}`}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/20 bg-white/5 px-6 text-base font-semibold text-white transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/40"
                  >
                    <Mail className="size-4 shrink-0" aria-hidden />
                    Email the team
                  </Link>
                ) : null}
              </div>
            </>
          ) : (
            <>
              <h1 className="mt-6 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">Almost there!</h1>
              <p className="mt-4 text-pretty text-sm leading-relaxed text-neutral-300">
                We&apos;re still confirming your payment with Stripe. This page can take a moment to catch up — you
                can also watch your inbox. Your reference:{" "}
                <span className="font-mono font-semibold text-cyan-200">{code}</span>
              </p>
              <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:justify-center">
                <Link
                  href="/login"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-teal-400 via-cyan-400 to-sky-500 px-6 text-base font-semibold text-neutral-950 shadow-lg transition hover:brightness-110"
                >
                  <Home className="size-4 shrink-0" aria-hidden />
                  Back to home
                </Link>
                <Link
                  href="/register"
                  className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/20 bg-white/5 px-6 text-base font-semibold text-white hover:bg-white/10"
                >
                  Return to registration
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
