import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  ageForClassroomRule,
  ageRangeOverlaps,
  findInternalAgeGaps,
} from "@/lib/class-assignment";
import { getEnrollmentCountsByClassroom } from "@/lib/classroom-enrollment";
import { canManageDirectory, canViewOperations } from "@/lib/roles";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function AssignmentRulesPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.role) redirect("/login");
  if (!canViewOperations(session.user.role)) redirect("/dashboard");
  if (!canManageDirectory(session.user.role)) redirect("/classes");

  const sp = await searchParams;
  const seasons = await prisma.vbsSeason.findMany({
    orderBy: [{ year: "desc" }, { startDate: "desc" }],
    select: { id: true, name: true, year: true, startDate: true, isActive: true },
  });
  if (seasons.length === 0) {
    return (
      <div className="mx-auto max-w-3xl">
        <p className="text-muted">No seasons yet.</p>
      </div>
    );
  }

  const defaultId = seasons.find((s) => s.isActive)?.id ?? seasons[0]!.id;
  const seasonId = sp.season?.trim() || defaultId;
  const season = seasons.find((s) => s.id === seasonId) ?? seasons[0]!;

  const classes = await prisma.classroom.findMany({
    where: { seasonId: season.id },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  const counts = await getEnrollmentCountsByClassroom(season.id);

  const activeRanges = classes
    .filter((c) => c.isActive && c.useAgeRuleForAutoAssign)
    .map((c) => ({ id: c.id, ageMin: c.ageMin, ageMax: c.ageMax, name: c.name }));
  const gapAges = findInternalAgeGaps(activeRanges);

  function effRange(c: (typeof classes)[0]) {
    return c.useAgeRuleForAutoAssign === false
      ? ({ lo: 0, hi: 99, label: "any age (auto)" } as const)
      : ({ lo: c.ageMin, hi: c.ageMax, label: `${c.ageMin}–${c.ageMax}` } as const);
  }

  const overlaps: string[] = [];
  for (let i = 0; i < classes.length; i++) {
    const ci = classes[i]!;
    if (!ci.isActive) continue;
    for (let j = i + 1; j < classes.length; j++) {
      const cj = classes[j]!;
      if (!cj.isActive) continue;
      const a = effRange(ci);
      const b = effRange(cj);
      if (ageRangeOverlaps(a.lo, a.hi, b.lo, b.hi)) {
        overlaps.push(`“${ci.name}” (${a.label}) vs “${cj.name}” (${b.label})`);
      }
    }
  }

  const regAt = new Date();
  const previewAges = Array.from({ length: 15 }, (_, i) => i + 2);

  function firstMatch(ageYears: number): string {
    const sorted = [...classes].sort(
      (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
    );
    const refDob = new Date(season.startDate);
    refDob.setFullYear(refDob.getFullYear() - ageYears);
    for (const c of sorted) {
      if (!c.isActive || c.intakeStatus !== "OPEN") continue;
      if (c.useAgeRuleForAutoAssign !== false) {
        const computed = ageForClassroomRule(refDob, c.ageRule, regAt, season.startDate);
        if (computed < c.ageMin || computed > c.ageMax) continue;
      }
      return c.name;
    }
    return "—";
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <Link href="/classes" className="text-sm font-medium text-brand underline">
          ← Classes
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Assignment rules</h1>
        <p className="mt-1 text-muted">
          Age bands are optional for auto-placement (classes can ignore age). This page still shows
          listed ages for reference. Gaps and overlaps consider only classes that require an age
          band. Preview uses hypothetical birthdays at event start (approximate). Form-field rules
          are on each class’s edit page.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted">Season</span>
        <div className="flex flex-wrap gap-2">
          {seasons.map((s) => (
            <Link
              key={s.id}
              href={`/classes/assignment-rules?season=${s.id}`}
              className={`rounded-lg border px-3 py-1.5 text-sm ${
                s.id === season.id
                  ? "border-brand bg-brand/10 font-medium text-brand"
                  : "border-foreground/15 hover:bg-foreground/[0.04]"
              }`}
            >
              {s.name} ({s.year})
            </Link>
          ))}
        </div>
      </div>

      {gapAges.length > 0 ? (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
          <p className="font-medium text-amber-950 dark:text-amber-100">Gaps inside combined range</p>
          <p className="mt-1 text-amber-900/90 dark:text-amber-100/90">
            These whole ages are not covered by any <strong>active</strong> class between the min and
            max age you&apos;ve defined: {gapAges.join(", ")}
          </p>
        </div>
      ) : activeRanges.length > 0 ? (
        <p className="text-sm text-emerald-800 dark:text-emerald-200">
          No gaps between the lowest and highest active class ages.
        </p>
      ) : classes.some((c) => c.isActive) ? (
        <p className="text-sm text-muted">
          No active classes require an age band — gap check does not apply.
        </p>
      ) : null}

      {overlaps.length > 0 ? (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
          <p className="font-medium text-amber-950 dark:text-amber-100">Overlapping active classes</p>
          <ul className="mt-2 list-disc pl-5">
            {overlaps.map((o) => (
              <li key={o}>{o}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-amber-900/80 dark:text-amber-100/80">
            Lower sort priority / match order wins for auto-placement.
          </p>
        </div>
      ) : classes.filter((c) => c.isActive).length > 1 ? (
        <p className="text-sm text-muted">No overlapping effective ranges among active classes.</p>
      ) : null}

      <section className="overflow-hidden rounded-xl border border-foreground/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-foreground/[0.04] text-foreground/70">
            <tr>
              <th className="px-4 py-3 font-medium">Class</th>
              <th className="px-4 py-3 font-medium">Ages</th>
              <th className="px-4 py-3 font-medium">Priority</th>
              <th className="px-4 py-3 font-medium">Capacity</th>
              <th className="px-4 py-3 font-medium">Seated / WL</th>
              <th className="px-4 py-3 font-medium">Intake</th>
            </tr>
          </thead>
          <tbody>
            {classes.map((c) => {
              const ec = counts.get(c.id) ?? { seated: 0, waitlisted: 0 };
              const full = c.capacity > 0 && ec.seated >= c.capacity;
              return (
                <tr key={c.id} className="border-t border-foreground/10">
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/classes/${c.id}`} className="text-brand underline">
                      {c.name}
                    </Link>
                    {!c.isActive ? (
                      <span className="ml-2 text-xs text-muted">(inactive)</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {c.useAgeRuleForAutoAssign === false ? (
                      <span className="text-muted">Any age</span>
                    ) : (
                      <>
                        {c.ageMin}–{c.ageMax}
                      </>
                    )}
                  </td>
                  <td className="px-4 py-3 tabular-nums">{c.sortOrder}</td>
                  <td className="px-4 py-3 tabular-nums">{c.capacity}</td>
                  <td className="px-4 py-3 tabular-nums">
                    {ec.seated} / {ec.waitlisted}
                  </td>
                  <td className="px-4 py-3">
                    {c.intakeStatus === "OPEN" ? (
                      <span className="text-emerald-700 dark:text-emerald-300">Open</span>
                    ) : (
                      <span className="text-muted">Closed</span>
                    )}
                    {full && c.intakeStatus === "OPEN" ? (
                      <span className="ml-2 text-xs text-amber-800 dark:text-amber-200">(full)</span>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="rounded-xl border border-foreground/10 bg-surface-elevated p-5">
        <h2 className="text-sm font-semibold text-foreground">Preview: first matching class by age</h2>
        <p className="mt-1 text-xs text-muted">
          Illustrative only — real registration uses each child&apos;s date of birth and the class age
          rule (registration date vs event start).
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-muted">
              <tr>
                <th className="py-2 pr-4 text-left font-medium">Age (years)</th>
                <th className="py-2 text-left font-medium">Would match</th>
              </tr>
            </thead>
            <tbody>
              {previewAges.map((a) => (
                <tr key={a} className="border-t border-foreground/10">
                  <td className="py-2 pr-4 tabular-nums">{a}</td>
                  <td className="py-2">{firstMatch(a)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
