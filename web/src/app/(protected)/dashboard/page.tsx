import type { ComponentType, ReactNode } from "react";
import { auth } from "@/auth";
import { getDashboardSnapshot } from "@/lib/dashboard-data";
import type { EventPhase } from "@/lib/event-phase";
import { getPublicBaseUrl } from "@/lib/public-base-url";
import { canManageDirectory, canViewOperations } from "@/lib/roles";
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  ClipboardCheck,
  FileStack,
  LayoutDashboard,
  Megaphone,
  Printer,
  School,
  Sparkles,
  UserPlus,
  Users,
} from "lucide-react";
import Link from "next/link";

function formatRange(start: Date, end: Date) {
  const o = { month: "short" as const, day: "numeric" as const };
  const y = start.getFullYear() !== end.getFullYear();
  return `${start.toLocaleDateString(undefined, { ...o, year: y ? "numeric" : undefined })} – ${end.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
}

type KpiTone = "default" | "success" | "warning" | "danger" | "info";

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  href,
  actionLabel,
  tone = "default",
  emphasis = "default",
}: {
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  label: string;
  value: string | number;
  sub: string;
  href?: string;
  actionLabel?: string;
  tone?: KpiTone;
  emphasis?: "default" | "hero" | "alert";
}) {
  const toneStyles =
    tone === "success"
      ? "ring-emerald-500/20"
      : tone === "warning"
        ? "ring-amber-500/25"
        : tone === "danger"
          ? "ring-red-500/25"
          : tone === "info"
            ? "ring-sky-500/20"
            : "ring-foreground/8";

  const emphasisStyles =
    emphasis === "hero"
      ? "border-2 border-brand/40 bg-gradient-to-br from-brand-muted/50 via-surface-elevated to-surface-elevated shadow-md dark:from-brand-muted/20"
      : emphasis === "alert"
        ? "border-l-[6px] border-l-amber-500 bg-amber-500/[0.08] dark:bg-amber-500/12"
        : `border border-foreground/10 bg-surface-elevated ring-1 ${toneStyles}`;

  const valueClass =
    emphasis === "hero" ? "text-4xl font-bold tabular-nums tracking-tight" : "text-3xl font-bold tabular-nums tracking-tight";

  return (
    <li className="min-w-0">
      <div className={`flex h-full min-h-[9.5rem] flex-col rounded-xl p-4 shadow-sm ${emphasisStyles}`}>
        <div className="flex items-start justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">{label}</p>
          <Icon className="size-4 shrink-0 text-brand/90" aria-hidden />
        </div>
        <p className={`mt-3 text-foreground ${valueClass}`}>{value}</p>
        <p className="mt-1.5 text-xs leading-snug text-muted">{sub}</p>
        {href && actionLabel && (
          <Link
            href={href}
            className="mt-auto flex items-center gap-1 pt-4 text-xs font-semibold text-brand hover:underline"
          >
            {actionLabel}
            <ArrowRight className="size-3" aria-hidden />
          </Link>
        )}
      </div>
    </li>
  );
}

function SectionTitle({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 id={id} className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-muted">
      {children}
    </h2>
  );
}

function QuickAction({
  href,
  icon: Icon,
  title,
  hint,
}: {
  href: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  title: string;
  hint: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-3 rounded-xl border-2 border-foreground/10 bg-surface-elevated px-3 py-2.5 shadow-sm transition hover:border-brand/45 hover:shadow-md active:scale-[0.99] dark:hover:bg-brand-muted/10"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand text-brand-foreground shadow-sm">
        <Icon className="size-4" aria-hidden />
      </span>
      <span className="min-w-0 pt-0.5 text-left">
        <span className="block text-sm font-semibold text-foreground group-hover:text-brand">{title}</span>
        <span className="mt-0.5 block text-xs leading-snug text-muted">{hint}</span>
      </span>
    </Link>
  );
}

function PanelEmpty({
  icon: Icon,
  title,
  description,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
}: {
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  title: string;
  description: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
}) {
  return (
    <div className="flex flex-col items-center px-3 py-8 text-center">
      <Icon className="size-9 text-brand/55" aria-hidden />
      <p className="mt-3 text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-1.5 max-w-xs text-xs leading-relaxed text-muted">{description}</p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <Link
          href={primaryHref}
          className="inline-flex rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-brand-foreground hover:opacity-90"
        >
          {primaryLabel}
        </Link>
        {secondaryHref && secondaryLabel && (
          <Link
            href={secondaryHref}
            className="inline-flex rounded-lg border border-foreground/15 px-3 py-2 text-xs font-medium hover:bg-foreground/[0.04]"
          >
            {secondaryLabel}
          </Link>
        )}
      </div>
    </div>
  );
}

function headerCtas(
  phase: EventPhase,
  manage: boolean,
  publicBase: string,
): Array<{ key: string; href: string; label: string; primary?: boolean; external?: boolean }> {
  if (phase === "live") {
    return [
      { key: "in", href: "/check-in", label: "Open check-in", primary: true },
      { key: "badges", href: "/reports", label: "Print badges" },
      { key: "reg", href: "/registrations", label: "Registrations" },
    ];
  }
  if (phase === "wrapup") {
    return [
      { key: "rep", href: "/reports", label: "Reports & exports", primary: true },
      { key: "reg", href: "/registrations", label: "View registrations" },
      { key: "set", href: "/settings", label: "Settings" },
    ];
  }
  const out = [
    { key: "reg", href: "/registrations", label: "View registrations", primary: true as const },
    { key: "cls", href: "/classes", label: "Manage classes" },
    {
      key: "pub",
      href: `${publicBase}/register`,
      label: "View public page",
      external: true as const,
    },
  ];
  if (manage) {
    out.splice(1, 0, { key: "new", href: "/registrations/new", label: "New registration" });
  }
  return out;
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) return null;

  const ops = canViewOperations(session.user.role);
  const manage = canManageDirectory(session.user.role);
  const data = ops ? await getDashboardSnapshot() : null;
  const publicBase = ops ? await getPublicBaseUrl() : "";

  return (
    <div className="mx-auto max-w-6xl space-y-9 pb-12">
      {session.user.role === "PARENT" && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
          Parent portal (registrations and messaging for your family) is planned for a follow-up milestone. For now,
          contact the church office for VBS questions.
        </div>
      )}

      {ops && data && (
        <>
          <header className="overflow-hidden rounded-2xl border border-brand/20 bg-gradient-to-br from-brand-muted/55 via-surface-elevated to-surface-elevated shadow-sm dark:from-brand-muted/20 dark:via-background dark:to-background">
            <div className="flex flex-col gap-6 p-6 sm:p-8 lg:flex-row lg:items-start lg:justify-between lg:gap-8">
              <div className="min-w-0 flex-1 space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/15 px-2.5 py-1 text-xs font-semibold text-brand dark:bg-brand/25 dark:text-brand-ring">
                    <Sparkles className="size-3.5" aria-hidden />
                    {data.eventPhase === "live"
                      ? "Live week"
                      : data.eventPhase === "setup"
                        ? "Getting ready"
                        : data.eventPhase === "wrapup"
                          ? "Post-VBS"
                          : "Overview"}
                  </span>
                  {data.activeSeason && (
                    <span
                      className={
                        data.activeSeason.isActive
                          ? "inline-flex rounded-full bg-emerald-600/15 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200"
                          : "inline-flex rounded-full bg-foreground/10 px-2.5 py-1 text-xs font-semibold text-muted"
                      }
                    >
                      {data.activeSeason.isActive ? "Season active" : "Season paused"}
                    </span>
                  )}
                  {data.activeSeason && (
                    <span
                      className={
                        data.activeSeason.publicRegistrationOpen
                          ? "inline-flex rounded-full bg-sky-500/15 px-2.5 py-1 text-xs font-semibold text-sky-900 dark:text-sky-200"
                          : "inline-flex rounded-full bg-foreground/10 px-2.5 py-1 text-xs font-semibold text-muted"
                      }
                    >
                      {data.activeSeason.publicRegistrationOpen ? "Signup open" : "Signup closed"}
                    </span>
                  )}
                </div>
                <div>
                  <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                    {data.activeSeason?.name ?? "IPC Hebron VBS"}
                  </h1>
                  {data.activeSeason ? (
                    <>
                      <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-base font-medium text-foreground/85">
                        <Calendar className="size-4 shrink-0 text-brand" aria-hidden />
                        {formatRange(data.activeSeason.startDate, data.activeSeason.endDate)}
                        {data.eventDayLabel && (
                          <>
                            <span className="text-muted">·</span>
                            <span className="text-brand">{data.eventDayLabel}</span>
                          </>
                        )}
                      </p>
                      <p className="mt-3 text-sm font-medium text-foreground/80">
                        {data.activeSeason.publicRegistrationOpen ? "Registration open" : "Registration closed"}
                        {data.totalSeatCapacity > 0
                          ? ` · ${data.kpis.registrationTotal}/${data.totalSeatCapacity} registered`
                          : ` · ${data.kpis.registrationTotal} registered`}
                        {data.eventPhase === "setup" && data.daysUntilStart != null && (
                          <>
                            {" "}
                            ·{" "}
                            <span className="text-brand">
                              {data.daysUntilStart === 0
                                ? "Starts today"
                                : `${data.daysUntilStart} day${data.daysUntilStart === 1 ? "" : "s"} until VBS`}
                            </span>
                          </>
                        )}
                        {data.eventPhase === "live" && (
                          <>
                            {" "}
                            ·{" "}
                            <span className="text-emerald-700 dark:text-emerald-300">
                              {data.kpis.checkedInToday} checked in today
                            </span>
                          </>
                        )}
                        {data.eventPhase === "wrapup" && (
                          <>
                            {" "}
                            · <span className="text-muted">Great work—wrap up rosters and thank your team.</span>
                          </>
                        )}
                      </p>
                      <p className="mt-2 text-xs text-muted">
                        Close or open signup anytime in{" "}
                        <Link href="/settings" className="font-medium text-brand underline-offset-2 hover:underline">
                          Settings
                        </Link>{" "}
                        → VBS seasons. (No automatic cutoff date is set.)
                      </p>
                    </>
                  ) : (
                    <p className="mt-2 text-sm text-muted">
                      Add an active season under Settings to unlock dates, capacity, and check-in.
                    </p>
                  )}
                </div>
              </div>
              <div className="flex flex-shrink-0 flex-wrap gap-2 lg:flex-col lg:items-stretch">
                {headerCtas(data.eventPhase, manage, publicBase).map((a) =>
                  a.external ? (
                    <a
                      key={a.key}
                      href={a.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={
                        a.primary
                          ? "inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-center text-sm font-semibold text-brand-foreground shadow-sm hover:opacity-90"
                          : "inline-flex items-center justify-center gap-2 rounded-lg border border-foreground/15 bg-surface-elevated px-4 py-2.5 text-center text-sm font-semibold hover:bg-foreground/[0.04]"
                      }
                    >
                      {a.label}
                      <ArrowRight className="size-3.5 opacity-70" aria-hidden />
                    </a>
                  ) : (
                    <Link
                      key={a.key}
                      href={a.href}
                      className={
                        a.primary
                          ? "inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-center text-sm font-semibold text-brand-foreground shadow-sm hover:opacity-90"
                          : "inline-flex items-center justify-center gap-2 rounded-lg border border-foreground/15 bg-surface-elevated px-4 py-2.5 text-center text-sm font-semibold hover:bg-foreground/[0.04]"
                      }
                    >
                      {a.label}
                    </Link>
                  ),
                )}
              </div>
            </div>
          </header>

          {data.eventPhase === "live" && (
            <section aria-labelledby="live-ops-heading" className="space-y-3">
              <SectionTitle id="live-ops-heading">Today&apos;s operations — live board</SectionTitle>
              <div className="grid gap-4 lg:grid-cols-12">
                <div className="rounded-xl border-2 border-brand/35 bg-gradient-to-b from-brand-muted/40 to-surface-elevated p-5 shadow-md dark:from-brand-muted/15 lg:col-span-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-brand">Right now</p>
                  <p className="mt-2 text-4xl font-bold tabular-nums text-foreground">{data.kpis.checkedInToday}</p>
                  <p className="text-sm font-medium text-muted">Checked in today</p>
                  <p className="mt-4 text-2xl font-bold tabular-nums text-foreground">{data.kpis.awaitingCheckIn}</p>
                  <p className="text-xs text-muted">Still awaiting check-in (active enrollments)</p>
                  <Link
                    href="/check-in"
                    className="mt-5 inline-flex w-full items-center justify-center rounded-lg bg-brand py-2.5 text-sm font-semibold text-brand-foreground hover:opacity-90"
                  >
                    Open check-in desk
                  </Link>
                  <p className="mt-4 border-t border-foreground/10 pt-3 text-xs text-muted">
                    Pickup &amp; check-out tracking and badge reprints aren&apos;t in the app yet—we&apos;re focusing on
                    arrival check-in first.
                  </p>
                </div>
                <div className="rounded-xl border border-foreground/10 bg-surface-elevated p-5 shadow-sm lg:col-span-8">
                  <h3 className="text-sm font-semibold text-foreground">Today&apos;s attendance by class</h3>
                  <p className="mt-0.5 text-xs text-muted">
                    Share of enrolled students checked in today (updates as you use check-in).
                  </p>
                  {data.classAttendanceToday.length === 0 ? (
                    <PanelEmpty
                      icon={School}
                      title="No classes for this season"
                      description="Add classes under your active season to see per-room attendance here."
                      primaryHref="/seasons"
                      primaryLabel="Open seasons"
                      secondaryHref="/classes"
                      secondaryLabel="View classes"
                    />
                  ) : (
                    <ul className="mt-4 space-y-2">
                      {data.classAttendanceToday.map((row) => {
                        const low = row.enrolled > 0 && row.pctCheckedIn < 50 && data.kpis.checkedInToday > 0;
                        const none = row.enrolled > 0 && row.checkedInToday === 0 && data.kpis.checkedInToday > 0;
                        return (
                          <li
                            key={row.classroomId}
                            className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm ${
                              none
                                ? "border-amber-500/40 bg-amber-500/10"
                                : low
                                  ? "border-amber-500/25 bg-amber-500/5"
                                  : "border-foreground/10 bg-foreground/[0.02]"
                            }`}
                          >
                            <span className="font-medium text-foreground">{row.name}</span>
                            <span className="tabular-nums text-xs text-muted">
                              {row.checkedInToday}/{row.enrolled} ·{" "}
                              <span className="font-semibold text-foreground">{row.pctCheckedIn}%</span>
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
              {data.classesNoCheckInToday.length > 0 && (
                <div className="rounded-xl border border-amber-500/35 bg-amber-500/[0.07] px-4 py-4 dark:bg-amber-500/10">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-amber-950 dark:text-amber-100">
                    <AlertTriangle className="size-4 shrink-0" aria-hidden />
                    Classes with no check-ins yet today
                  </h3>
                  <p className="mt-1 text-xs text-amber-950/80 dark:text-amber-100/80">
                    Rooms with enrolled students but zero arrivals recorded so far—worth a quick look if camp is
                    underway.
                  </p>
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {data.classesNoCheckInToday.map((c) => (
                      <li
                        key={c.classroomId}
                        className="rounded-full bg-surface-elevated px-3 py-1 text-xs font-medium text-foreground shadow-sm"
                      >
                        {c.name} ({c.enrolled} enrolled)
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}

          <section aria-labelledby="overview-heading" className="space-y-3">
            <SectionTitle id="overview-heading">Overview</SectionTitle>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <KpiCard
                icon={Users}
                label="Registrations"
                value={data.kpis.registrationTotal}
                sub={`${data.kpis.registrationsThisWeek} new this week · ${data.kpis.studentProfilesCount} student profiles`}
                href="/registrations"
                actionLabel="View all"
                tone="info"
              />
              <KpiCard
                icon={School}
                label="Classes"
                value={data.kpis.classesActive}
                sub={
                  data.kpis.classesFull > 0
                    ? `${data.kpis.classesFull} full · ${data.kpis.classesNearFull} near capacity`
                    : data.kpis.classesNearFull > 0
                      ? `${data.kpis.classesNearFull} near capacity`
                      : "Capacity on track"
                }
                href="/classes"
                actionLabel="Manage classes"
                tone={data.kpis.classesFull > 0 ? "danger" : data.kpis.classesNearFull > 0 ? "warning" : "success"}
                emphasis={data.kpis.classesFull > 0 || data.kpis.classesNearFull > 0 ? "alert" : "default"}
              />
              <KpiCard
                icon={ClipboardCheck}
                label="Check-in today"
                value={data.kpis.checkedInToday}
                sub={`${data.kpis.awaitingCheckIn} awaiting check-in`}
                href="/check-in"
                actionLabel="Open attendance"
                tone="success"
                emphasis={data.eventPhase === "live" ? "hero" : "default"}
              />
              <KpiCard
                icon={UserPlus}
                label="Pending assignments"
                value={data.kpis.pendingAssignments}
                sub="Enrolled but no class assigned"
                href="/registrations"
                actionLabel="Assign students"
                tone={data.kpis.pendingAssignments > 0 ? "warning" : "default"}
                emphasis={data.kpis.pendingAssignments > 0 ? "alert" : "default"}
              />
              <KpiCard
                icon={Calendar}
                label="Active seasons"
                value={data.kpis.activeSeasonsCount}
                sub="Camp years marked active"
                href="/seasons"
                actionLabel="Seasons"
              />
              <KpiCard
                icon={Users}
                label="Volunteers"
                value={data.kpis.volunteerCount}
                sub={
                  data.kpis.teachersUnassigned > 0
                    ? `${data.kpis.teachersUnassigned} roles not tied to a class`
                    : "Roster looks staffed"
                }
                href="/volunteers"
                actionLabel="View volunteers"
                tone={data.kpis.teachersUnassigned > 0 ? "warning" : "default"}
                emphasis={data.kpis.teachersUnassigned > 0 ? "alert" : "default"}
              />
            </ul>
          </section>

          <section aria-labelledby="quick-actions-heading" className="space-y-3">
            <SectionTitle id="quick-actions-heading">Quick actions</SectionTitle>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {manage && (
                <QuickAction
                  href="/registrations/new"
                  icon={UserPlus}
                  title="New registration"
                  hint="Add a student and guardian in one guided flow."
                />
              )}
              <QuickAction
                href="/check-in"
                icon={ClipboardCheck}
                title="Open check-in desk"
                hint="Record today’s arrivals and line up badges at the door."
              />
              <QuickAction
                href="/reports"
                icon={Printer}
                title="Print badges & reports"
                hint="Roster exports and printable materials (more coming soon)."
              />
              <QuickAction
                href="/classes"
                icon={School}
                title="Manage classes"
                hint="Review capacity, age bands, and room balance."
              />
              <QuickAction
                href="/content/announcements"
                icon={Megaphone}
                title="Post an announcement"
                hint="Share reminders—full composer is on the roadmap."
              />
              <QuickAction
                href="/content/documents"
                icon={FileStack}
                title="Upload a schedule"
                hint="File storage is coming; link handouts from season settings today."
              />
            </div>
          </section>

          {data.eventPhase !== "live" && (
            <section aria-labelledby="ops-heading" className="space-y-3">
              <SectionTitle id="ops-heading">
                {data.eventPhase === "setup"
                  ? "Before VBS week"
                  : data.eventPhase === "wrapup"
                    ? "After VBS"
                    : "Today’s operations"}
              </SectionTitle>
              <p className="-mt-1 text-xs text-muted">
                {data.eventPhase === "setup" &&
                  "During camp, this area becomes a live board for check-in and room-by-room attendance."}
                {data.eventPhase === "wrapup" &&
                  "Use reports and registrations to finish rosters and say thanks—live check-in stats stay below for reference."}
                {data.eventPhase === "none" && "Set an active season to unlock check-in and capacity tools."}
              </p>
              <div className="grid gap-4 lg:grid-cols-12 lg:items-stretch">
                <div className="flex min-h-[12rem] flex-col rounded-xl border border-foreground/10 bg-surface-elevated shadow-sm lg:col-span-4">
                  <div className="border-b border-foreground/10 px-4 py-3">
                    <h3 className="text-sm font-semibold text-foreground">Check-ins by class (today)</h3>
                  </div>
                  {data.topCheckInClassesToday.length === 0 ? (
                    <PanelEmpty
                      icon={ClipboardCheck}
                      title="No check-ins yet today"
                      description="When you start scanning or tapping arrivals, you’ll see which rooms are busiest."
                      primaryHref="/check-in"
                      primaryLabel="Open check-in"
                    />
                  ) : (
                    <ol className="flex-1 space-y-2 p-4 text-sm">
                      {data.topCheckInClassesToday.map((c, i) => (
                        <li key={c.classroomId} className="flex justify-between gap-2">
                          <span className="text-muted">
                            {i + 1}. {c.name}
                          </span>
                          <span className="tabular-nums font-semibold text-foreground">{c.count}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
                <div className="flex min-h-[12rem] flex-col rounded-xl border border-foreground/10 bg-surface-elevated shadow-sm lg:col-span-4">
                  <div className="flex items-center justify-between gap-2 border-b border-foreground/10 px-4 py-3">
                    <h3 className="text-sm font-semibold text-foreground">Recent registrations</h3>
                    <Link href="/registrations" className="text-xs font-semibold text-brand hover:underline">
                      View all
                    </Link>
                  </div>
                  {data.recentRegistrations.length === 0 ? (
                    <PanelEmpty
                      icon={Users}
                      title="No registrations yet"
                      description="Open online signup or add families from the desk to fill this list."
                      primaryHref={manage ? "/registrations/new" : "/registrations"}
                      primaryLabel={manage ? "Add registration" : "View registrations"}
                      secondaryHref="/register"
                      secondaryLabel="Public signup page"
                    />
                  ) : (
                    <ul className="flex-1 space-y-2 p-4 text-sm">
                      {data.recentRegistrations.map((r) => (
                        <li key={r.id} className="border-b border-foreground/5 pb-2 last:border-0 last:pb-0">
                          <span className="font-medium text-foreground">{r.childName}</span>
                          <span className="mt-0.5 block text-xs text-muted">
                            {r.seasonName}
                            {r.classroomName ? ` · ${r.classroomName}` : " · Unassigned"} · {r.status}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="flex min-h-[12rem] flex-col rounded-xl border border-foreground/10 bg-surface-elevated shadow-sm lg:col-span-4">
                  <div className="flex items-center justify-between gap-2 border-b border-foreground/10 px-4 py-3">
                    <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                      {data.capacityAlerts.length > 0 && (
                        <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" aria-hidden />
                      )}
                      Capacity alerts
                    </h3>
                    <Link href="/classes" className="text-xs font-semibold text-brand hover:underline">
                      Classes
                    </Link>
                  </div>
                  {data.capacityAlerts.length === 0 ? (
                    <PanelEmpty
                      icon={LayoutDashboard}
                      title="All clear on capacity"
                      description="We’ll flag rooms at or above 80% so you can open another class or shift ages."
                      primaryHref="/classes"
                      primaryLabel="Review classes"
                    />
                  ) : (
                    <ul className="flex-1 space-y-2 p-4 text-sm">
                      {data.capacityAlerts.map((a) => (
                        <li
                          key={a.classroomId}
                          className="rounded-lg border border-amber-500/25 bg-amber-500/[0.06] px-3 py-2 dark:bg-amber-500/10"
                        >
                          <span className="font-semibold text-foreground">{a.name}</span>
                          <span className="mt-0.5 block text-xs text-muted">
                            {a.seasonName} · {a.enrolled}/{a.capacity} ({Math.round(a.pct * 100)}%)
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </section>
          )}

          {data.eventPhase === "live" && (
            <section aria-labelledby="ops-secondary-heading" className="space-y-3">
              <SectionTitle id="ops-secondary-heading">Registrations &amp; capacity</SectionTitle>
              <div className="grid gap-4 lg:grid-cols-12 lg:items-stretch">
                <div className="flex min-h-[11rem] flex-col rounded-xl border border-foreground/10 bg-surface-elevated shadow-sm lg:col-span-4">
                  <div className="flex items-center justify-between gap-2 border-b border-foreground/10 px-4 py-3">
                    <h3 className="text-sm font-semibold text-foreground">Recent registrations</h3>
                    <Link href="/registrations" className="text-xs font-semibold text-brand hover:underline">
                      View all
                    </Link>
                  </div>
                  {data.recentRegistrations.length === 0 ? (
                    <PanelEmpty
                      icon={Users}
                      title="No registrations yet"
                      description="Walk-ins can still be added from the desk."
                      primaryHref={manage ? "/registrations/new" : "/registrations"}
                      primaryLabel={manage ? "Add registration" : "Registrations"}
                    />
                  ) : (
                    <ul className="flex-1 space-y-2 p-4 text-sm">
                      {data.recentRegistrations.slice(0, 6).map((r) => (
                        <li key={r.id} className="border-b border-foreground/5 pb-2 last:border-0 last:pb-0">
                          <span className="font-medium text-foreground">{r.childName}</span>
                          <span className="mt-0.5 block text-xs text-muted">
                            {r.classroomName ?? "Unassigned"} · {r.status}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="flex min-h-[11rem] flex-col rounded-xl border border-foreground/10 bg-surface-elevated shadow-sm lg:col-span-4">
                  <div className="flex items-center justify-between gap-2 border-b border-foreground/10 px-4 py-3">
                    <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                      <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" aria-hidden />
                      Capacity alerts
                    </h3>
                    <Link href="/classes" className="text-xs font-semibold text-brand hover:underline">
                      Classes
                    </Link>
                  </div>
                  {data.capacityAlerts.length === 0 ? (
                    <PanelEmpty
                      icon={LayoutDashboard}
                      title="No rooms over 80%"
                      description="Capacity is comfortable—keep an eye on assignments as walk-ins arrive."
                      primaryHref="/classes"
                      primaryLabel="View classes"
                    />
                  ) : (
                    <ul className="flex-1 space-y-2 p-4 text-sm">
                      {data.capacityAlerts.map((a) => (
                        <li
                          key={a.classroomId}
                          className="rounded-lg border border-red-500/20 bg-red-500/[0.06] px-3 py-2 dark:bg-red-500/10"
                        >
                          <span className="font-semibold text-foreground">{a.name}</span>
                          <span className="mt-0.5 block text-xs text-muted">
                            {a.enrolled}/{a.capacity} full ({Math.round(a.pct * 100)}%)
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="flex min-h-[11rem] flex-col rounded-xl border border-foreground/10 bg-surface-elevated p-4 shadow-sm lg:col-span-4">
                  <h3 className="text-sm font-semibold text-foreground">Top check-ins (today)</h3>
                  {data.topCheckInClassesToday.length === 0 ? (
                    <p className="mt-3 text-xs text-muted">No class-level check-ins recorded yet.</p>
                  ) : (
                    <ol className="mt-3 space-y-1.5 text-sm">
                      {data.topCheckInClassesToday.map((c, i) => (
                        <li key={c.classroomId} className="flex justify-between gap-2">
                          <span className="text-muted">
                            {i + 1}. {c.name}
                          </span>
                          <span className="tabular-nums font-semibold">{c.count}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              </div>
            </section>
          )}

          <section aria-labelledby="content-heading" className="space-y-3">
            <SectionTitle id="content-heading">Content &amp; registration</SectionTitle>
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="flex min-h-[11rem] flex-col rounded-xl border border-dashed border-foreground/15 bg-surface-elevated p-5">
                <h3 className="text-sm font-semibold text-foreground">Announcements</h3>
                <p className="mt-1 flex-1 text-xs leading-relaxed text-muted">
                  Nothing posted in-app yet—tell families what&apos;s happening this week.
                </p>
                <Link
                  href="/content/announcements"
                  className="mt-4 inline-flex w-fit rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-brand-foreground hover:opacity-90"
                >
                  Go to announcements
                </Link>
              </div>
              <div className="flex min-h-[11rem] flex-col rounded-xl border border-dashed border-foreground/15 bg-surface-elevated p-5">
                <h3 className="text-sm font-semibold text-foreground">Documents</h3>
                <p className="mt-1 flex-1 text-xs leading-relaxed text-muted">
                  Upload schedules when file storage ships—link PDFs from welcome text today.
                </p>
                <Link
                  href="/content/documents"
                  className="mt-4 inline-flex w-fit rounded-lg border border-foreground/15 px-3 py-2 text-xs font-semibold hover:bg-foreground/[0.04]"
                >
                  Go to documents
                </Link>
              </div>
              <div className="flex min-h-[11rem] flex-col rounded-xl border border-foreground/10 bg-surface-elevated p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-foreground">Public signup</h3>
                <p className="mt-1 flex-1 text-xs leading-relaxed text-muted">
                  {data.activeSeason
                    ? data.activeSeason.publicRegistrationOpen
                      ? "Families can use your public page to register."
                      : "Turn registration back on anytime from season settings."
                    : "Activate a season to control the public form."}
                </p>
                {manage && data.activeSeason && (
                  <Link
                    href={`/seasons/${data.activeSeason.id}/public-settings`}
                    className="mt-4 inline-flex w-fit text-xs font-semibold text-brand hover:underline"
                  >
                    Edit public form
                  </Link>
                )}
              </div>
            </div>
          </section>

          <section aria-labelledby="people-heading" className="space-y-3">
            <SectionTitle id="people-heading">People &amp; assignments</SectionTitle>
            <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch">
              <div className="flex min-h-[11rem] flex-col rounded-xl border border-foreground/10 bg-surface-elevated shadow-sm">
                <div className="flex items-center justify-between gap-2 border-b border-foreground/10 px-4 py-3">
                  <h3 className="text-sm font-semibold text-foreground">Unassigned students</h3>
                  <Link href="/registrations" className="text-xs font-semibold text-brand hover:underline">
                    Registrations
                  </Link>
                </div>
                {data.unassignedSample.length === 0 ? (
                  <PanelEmpty
                    icon={UserPlus}
                    title="Everyone has a room"
                    description="Or you don’t have open enrollments waiting for a class—nice and tidy."
                    primaryHref="/classes"
                    primaryLabel="View classes"
                  />
                ) : (
                  <ul className="flex-1 space-y-2 p-4 text-sm">
                    {data.unassignedSample.map((u) => (
                      <li key={u.id}>
                        <span className="font-medium text-foreground">{u.childName}</span>
                        <span className="mt-0.5 block text-xs text-muted">
                          {u.seasonName} · {u.status}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="flex min-h-[11rem] flex-col rounded-xl border border-foreground/10 bg-surface-elevated p-4 shadow-sm">
                <h3 className="text-sm font-semibold text-foreground">Activity log</h3>
                <p className="mt-2 flex-1 text-xs leading-relaxed text-muted">
                  A full audit trail is planned. For now, registrations and check-in are your source of truth for what
                  changed today.
                </p>
                <Link href="/reports" className="mt-4 inline-flex w-fit text-xs font-semibold text-brand hover:underline">
                  Open reports
                </Link>
              </div>
            </div>
          </section>
        </>
      )}

      {!ops && session.user.role !== "PARENT" && (
        <p className="text-muted">Use the navigation to view schedules and rosters you have access to.</p>
      )}
    </div>
  );
}
