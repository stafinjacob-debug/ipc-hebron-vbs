"use client";

import type { ClassroomIntakeStatus } from "@/generated/prisma";
import { ageRuleLabel } from "@/lib/class-assignment-shared";
import { MoreHorizontal, Table2, LayoutGrid } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  deleteClassroomAction,
  duplicateClassroomAction,
  setClassroomIntakeAction,
} from "./actions";

export type ClassOverviewRow = {
  id: string;
  name: string;
  seasonId: string;
  seasonName: string;
  seasonYear: number;
  seasonStart: string;
  ageMin: number;
  ageMax: number;
  ageRule: "REGISTRATION_DATE" | "EVENT_START_DATE";
  room: string | null;
  capacity: number;
  seated: number;
  waitlisted: number;
  intakeStatus: ClassroomIntakeStatus;
  isActive: boolean;
  waitlistEnabled: boolean;
  leaderNames: string[];
  hasOverlap: boolean;
  regCountNonCancelled: number;
};

function capacityVisual(row: ClassOverviewRow) {
  const cap = row.capacity;
  const n = row.seated;
  const over = cap > 0 && n > cap;
  const full = cap > 0 && n >= cap && !over;
  const pct = cap > 0 ? Math.min(100, Math.round((n / cap) * 100)) : 0;
  const amber = !full && !over && pct >= 80;
  let bar = "bg-brand";
  if (over || full) bar = "bg-red-500/80";
  else if (amber) bar = "bg-amber-500/80";

  let sub = "";
  if (over) sub = `${n - cap} over capacity`;
  else if (full) {
    sub = row.waitlistEnabled
      ? row.waitlisted > 0
        ? `Full · ${row.waitlisted} waitlisted`
        : "Full · waitlist on"
      : "Full";
  } else if (cap > 0) {
    const left = cap - n;
    sub = left <= 0 ? "" : `${left} seat${left === 1 ? "" : "s"} left`;
  }

  return { pct, bar, sub, over, full, amber };
}

function statusBadge(row: ClassOverviewRow) {
  if (row.intakeStatus === "CLOSED") {
    return (
      <span className="inline-flex rounded-full bg-foreground/15 px-2.5 py-0.5 text-xs font-medium text-foreground/80">
        Closed
      </span>
    );
  }
  const v = capacityVisual(row);
  if (v.over) {
    return (
      <span className="inline-flex rounded-full bg-red-500/15 px-2.5 py-0.5 text-xs font-medium text-red-800 dark:text-red-300">
        Over capacity
      </span>
    );
  }
  if (v.full) {
    return (
      <span className="inline-flex rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-medium text-amber-900 dark:text-amber-200">
        {row.waitlistEnabled ? "Full / waitlist" : "Full"}
      </span>
    );
  }
  if (v.amber) {
    return (
      <span className="inline-flex rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-medium text-amber-900 dark:text-amber-200">
        Open · 80%+
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-800 dark:text-emerald-300">
      Open
    </span>
  );
}

function ClassCard({
  row,
  canManage,
}: {
  row: ClassOverviewRow;
  canManage: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const v = capacityVisual(row);

  return (
    <li className="rounded-xl border border-foreground/10 bg-surface-elevated p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <Link
            href={`/classes/${row.id}`}
            className="font-semibold text-foreground hover:text-brand hover:underline"
          >
            {row.name}
          </Link>
          <p className="mt-1 text-sm text-muted">
            {row.seasonName} ({row.seasonYear})
          </p>
          <p className="mt-2 text-sm text-foreground/85">
            <span className="rounded-md bg-brand/10 px-2 py-0.5 font-medium text-brand">
              Ages {row.ageMin}–{row.ageMax}
            </span>
            <span className="ml-2 text-muted">· {ageRuleLabel(row.ageRule)}</span>
          </p>
          {row.room ? (
            <p className="mt-1 text-sm text-foreground/80">Room: {row.room}</p>
          ) : (
            <p className="mt-1 text-xs text-amber-800 dark:text-amber-200">No room assigned</p>
          )}
          <p className="mt-2 text-sm text-foreground/80">
            <span className="font-medium text-foreground">Leaders:</span>{" "}
            {row.leaderNames.length ? row.leaderNames.join(", ") : "None assigned"}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {statusBadge(row)}
            {!row.isActive && row.regCountNonCancelled > 0 ? (
              <span className="inline-flex rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-900 dark:text-amber-200">
                Inactive with enrollments
              </span>
            ) : null}
            {row.hasOverlap ? (
              <span className="inline-flex rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-900 dark:text-amber-200">
                Overlapping age rule
              </span>
            ) : null}
            {row.waitlisted > 0 ? (
              <span className="inline-flex rounded-full bg-foreground/10 px-2 py-0.5 text-xs text-foreground/70">
                {row.waitlisted} waitlisted
              </span>
            ) : null}
          </div>
        </div>
        {canManage ? (
          <div className="relative">
            <button
              type="button"
              className="rounded-lg border border-foreground/15 p-2 text-foreground/70 hover:bg-foreground/[0.05]"
              aria-expanded={open}
              aria-label="Class actions"
              onClick={() => setOpen((o) => !o)}
            >
              <MoreHorizontal className="size-5" />
            </button>
            {open ? (
              <div className="absolute right-0 z-20 mt-1 w-48 rounded-lg border border-foreground/15 bg-background py-1 shadow-lg">
                <Link
                  href={`/classes/${row.id}`}
                  className="block px-3 py-2 text-sm hover:bg-foreground/[0.05]"
                  onClick={() => setOpen(false)}
                >
                  View class
                </Link>
                <Link
                  href={`/classes/${row.id}/edit`}
                  className="block px-3 py-2 text-sm hover:bg-foreground/[0.05]"
                  onClick={() => setOpen(false)}
                >
                  Edit class
                </Link>
                <Link
                  href={`/classes/${row.id}#roster`}
                  className="block px-3 py-2 text-sm hover:bg-foreground/[0.05]"
                  onClick={() => setOpen(false)}
                >
                  View roster
                </Link>
                <button
                  type="button"
                  disabled={pending}
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-foreground/[0.05] disabled:opacity-50"
                  onClick={() => {
                    startTransition(async () => {
                      await setClassroomIntakeAction(
                        row.id,
                        row.intakeStatus === "CLOSED" ? "OPEN" : "CLOSED",
                      );
                      setOpen(false);
                      router.refresh();
                    });
                  }}
                >
                  {row.intakeStatus === "CLOSED" ? "Open class" : "Close class"}
                </button>
                <button
                  type="button"
                  disabled={pending}
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-foreground/[0.05] disabled:opacity-50"
                  onClick={() => {
                    startTransition(async () => {
                      await duplicateClassroomAction(row.id);
                      setOpen(false);
                      router.refresh();
                    });
                  }}
                >
                  Duplicate class
                </button>
                <button
                  type="button"
                  disabled={pending || row.regCountNonCancelled > 0}
                  className="block w-full px-3 py-2 text-left text-sm text-red-700 hover:bg-red-500/10 disabled:opacity-40 dark:text-red-300"
                  title={
                    row.regCountNonCancelled > 0
                      ? "Remove registrations first"
                      : "Delete unused class"
                  }
                  onClick={() => {
                    if (!confirm("Delete this class? This cannot be undone.")) return;
                    startTransition(async () => {
                      const r = await deleteClassroomAction(row.id);
                      alert(r.message);
                      setOpen(false);
                      router.refresh();
                    });
                  }}
                >
                  Delete if unused
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="mt-4">
        <div className="mb-1 flex justify-between text-xs text-muted">
          <span>
            {row.seated} / {row.capacity} enrolled
            {row.capacity > 0 ? ` · ${v.pct}%` : ""}
          </span>
          <span>{v.sub}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-foreground/10">
          <div className={`h-full rounded-full transition-all ${v.bar}`} style={{ width: `${v.pct}%` }} />
        </div>
      </div>
    </li>
  );
}

export function ClassesOverview({
  rows,
  canManage,
  seasonOptions,
  currentSeasonId,
  filterStatus,
}: {
  rows: ClassOverviewRow[];
  canManage: boolean;
  seasonOptions: { id: string; label: string }[];
  currentSeasonId: string;
  filterStatus: string;
}) {
  const [view, setView] = useState<"cards" | "table">("cards");
  const router = useRouter();

  const filtered = rows.filter((r) => {
    if (filterStatus === "open" && r.intakeStatus !== "OPEN") return false;
    if (filterStatus === "closed" && r.intakeStatus !== "CLOSED") return false;
    if (filterStatus === "full") {
      const v = capacityVisual(r);
      if (!v.full && !v.over) return false;
    }
    if (filterStatus === "no_leader" && r.leaderNames.length > 0) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm text-muted">
            Season
            <select
              className="ml-2 rounded-lg border border-foreground/15 bg-background px-2 py-1.5 text-sm"
              value={currentSeasonId}
              onChange={(e) => {
                const id = e.target.value;
                const u = new URLSearchParams(window.location.search);
                u.set("season", id);
                router.push(`/classes?${u.toString()}`);
              }}
            >
              {seasonOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-muted">
            Filter
            <select
              className="ml-2 rounded-lg border border-foreground/15 bg-background px-2 py-1.5 text-sm"
              value={filterStatus}
              onChange={(e) => {
                const u = new URLSearchParams(window.location.search);
                u.set("season", currentSeasonId);
                u.set("status", e.target.value);
                router.push(`/classes?${u.toString()}`);
              }}
            >
              <option value="all">All</option>
              <option value="open">Open intake</option>
              <option value="closed">Closed intake</option>
              <option value="full">Full / over</option>
              <option value="no_leader">No leader</option>
            </select>
          </label>
        </div>
        <div className="flex rounded-lg border border-foreground/15 p-0.5">
          <button
            type="button"
            className={`flex items-center gap-1 rounded-md px-2 py-1.5 text-sm ${view === "cards" ? "bg-brand/15 font-medium text-brand" : "text-muted"}`}
            onClick={() => setView("cards")}
          >
            <LayoutGrid className="size-4" />
            Cards
          </button>
          <button
            type="button"
            className={`flex items-center gap-1 rounded-md px-2 py-1.5 text-sm ${view === "table" ? "bg-brand/15 font-medium text-brand" : "text-muted"}`}
            onClick={() => setView("table")}
          >
            <Table2 className="size-4" />
            Table
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-foreground/10 bg-surface-elevated px-4 py-8 text-center text-sm text-muted">
          No classes match this filter.
        </p>
      ) : view === "cards" ? (
        <ul className="space-y-3">
          {filtered.map((row) => (
            <ClassCard key={row.id} row={row} canManage={canManage} />
          ))}
        </ul>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-foreground/10">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-foreground/[0.04] text-foreground/70">
              <tr>
                <th className="px-3 py-2 font-medium">Class</th>
                <th className="px-3 py-2 font-medium">Ages</th>
                <th className="px-3 py-2 font-medium">Leaders</th>
                <th className="px-3 py-2 font-medium">Room</th>
                <th className="px-3 py-2 font-medium">Seats</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const v = capacityVisual(row);
                return (
                  <tr key={row.id} className="border-t border-foreground/10">
                    <td className="px-3 py-2">
                      <Link href={`/classes/${row.id}`} className="font-medium text-brand underline">
                        {row.name}
                      </Link>
                      <div className="text-xs text-muted">
                        {row.seasonName} ({row.seasonYear})
                      </div>
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {row.ageMin}–{row.ageMax}
                    </td>
                    <td className="max-w-[180px] truncate px-3 py-2 text-muted" title={row.leaderNames.join(", ")}>
                      {row.leaderNames.length ? row.leaderNames.join(", ") : "—"}
                    </td>
                    <td className="px-3 py-2">{row.room ?? "—"}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {row.seated} / {row.capacity}
                      <div className="text-xs text-muted">{v.sub || `${v.pct}%`}</div>
                    </td>
                    <td className="px-3 py-2">{statusBadge(row)}</td>
                    <td className="px-3 py-2">
                      {canManage ? (
                        <Link
                          href={`/classes/${row.id}/edit`}
                          className="text-brand underline"
                        >
                          Edit
                        </Link>
                      ) : (
                        <Link href={`/classes/${row.id}`} className="text-brand underline">
                          View
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
