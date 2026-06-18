"use client";

import type {
  AutoAssignSimulationRow,
  AutoAssignSimulationSummary,
} from "@/lib/auto-assign-simulation";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { applyAutoAssignBatchAction, simulateAutoAssignAction } from "./actions";
import { enableClassAutoAssignAction } from "@/lib/class-settings-actions";

function outcomeLabel(row: AutoAssignSimulationRow): string {
  if (row.outcome === "already_assigned") return "Already assigned";
  if (row.outcome === "assignable") {
    if (row.proposedStatus === "WAITLIST") return "Assign · waitlist";
    return "Will assign";
  }
  return "No match";
}

function outcomeClass(row: AutoAssignSimulationRow): string {
  if (row.outcome === "assignable") {
    return row.proposedStatus === "WAITLIST"
      ? "text-amber-800 dark:text-amber-200"
      : "text-emerald-800 dark:text-emerald-200";
  }
  if (row.outcome === "already_assigned") return "text-muted";
  return "text-red-800 dark:text-red-300";
}

export function AutoAssignPanel({
  seasonId,
  seasonName,
  initialSummary,
}: {
  seasonId: string;
  seasonName: string;
  initialSummary: AutoAssignSimulationSummary;
}) {
  const router = useRouter();
  const [summary, setSummary] = useState(initialSummary);
  const [selected, setSelected] = useState<Set<string>>(() => {
    const ids = new Set<string>();
    for (const row of initialSummary.rows) {
      if (row.outcome === "assignable") ids.add(row.registrationId);
    }
    return ids;
  });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingSim, startSim] = useTransition();
  const [pendingApply, startApply] = useTransition();
  const [pendingEnable, startEnable] = useTransition();

  const assignableRows = useMemo(
    () => summary.rows.filter((r) => r.outcome === "assignable"),
    [summary.rows],
  );
  const unmatchedRows = useMemo(
    () => summary.rows.filter((r) => r.outcome === "no_match" && !r.currentClassroomId),
    [summary.rows],
  );
  const assignedRows = useMemo(
    () => summary.rows.filter((r) => r.outcome === "already_assigned"),
    [summary.rows],
  );

  function rerunSimulation() {
    setError(null);
    setMessage(null);
    startSim(async () => {
      const res = await simulateAutoAssignAction(seasonId);
      if (!res.ok || !res.summary) {
        setError(res.message);
        return;
      }
      setSummary(res.summary);
      const ids = new Set<string>();
      for (const row of res.summary.rows) {
        if (row.outcome === "assignable") ids.add(row.registrationId);
      }
      setSelected(ids);
      setMessage(res.message);
    });
  }

  function toggleAllAssignables(checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const row of assignableRows) {
        if (checked) next.add(row.registrationId);
        else next.delete(row.registrationId);
      }
      return next;
    });
  }

  function applySelected() {
    const ids = [...selected];
    if (ids.length === 0) {
      setError("Select at least one registration to assign.");
      return;
    }
    if (
      !confirm(
        `Apply auto-assignment to ${ids.length} registration${ids.length === 1 ? "" : "s"}? This updates class rosters immediately.`,
      )
    ) {
      return;
    }
    setError(null);
    setMessage(null);
    startApply(async () => {
      const res = await applyAutoAssignBatchAction(seasonId, ids);
      if (!res.ok && (res.applied ?? 0) === 0) {
        setError(res.message);
        if (res.details?.length) setError(`${res.message}\n${res.details.slice(0, 5).join("\n")}`);
        return;
      }
      setMessage(res.message);
      router.refresh();
      startSim(async () => {
        const sim = await simulateAutoAssignAction(seasonId);
        if (sim.summary) {
          setSummary(sim.summary);
          setSelected(new Set());
        }
      });
    });
  }

  function enableAutoAssign() {
    setError(null);
    setMessage(null);
    startEnable(async () => {
      const res = await enableClassAutoAssignAction(seasonId);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setMessage(res.message);
      router.refresh();
      startSim(async () => {
        const sim = await simulateAutoAssignAction(seasonId);
        if (sim.summary) {
          setSummary(sim.summary);
          const ids = new Set<string>();
          for (const row of sim.summary.rows) {
            if (row.outcome === "assignable") ids.add(row.registrationId);
          }
          setSelected(ids);
        }
      });
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted">
            Event: <strong className="text-foreground">{seasonName}</strong>
          </p>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Preview where auto-assignment rules would place <strong>unassigned</strong> registrations
            (oldest first, respecting capacity and round-robin). Approve rows to apply them without
            changing already-assigned students.
          </p>
        </div>
        <button
          type="button"
          disabled={pendingSim || pendingApply}
          onClick={rerunSimulation}
          className="rounded-lg border border-foreground/20 px-3 py-2 text-sm font-medium hover:bg-foreground/[0.04] disabled:opacity-50"
        >
          {pendingSim ? "Running…" : "Re-run simulation"}
        </button>
      </div>

      {!summary.classroomsEnabled ? (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-4 text-sm text-amber-950 dark:text-amber-100">
          <p className="font-medium">Class auto-assignment is off for this event.</p>
          <p className="mt-1">
            Enable it to preview and apply class placements. You can also manage this under{" "}
            <Link href={`/classes/settings?season=${seasonId}`} className="font-semibold underline">
              Classes → Class settings
            </Link>
            .
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pendingEnable || pendingSim || pendingApply}
              onClick={enableAutoAssign}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground disabled:opacity-50"
            >
              {pendingEnable ? "Enabling…" : "Enable auto-assignment for this event"}
            </button>
            <Link
              href={`/classes/settings?season=${seasonId}`}
              className="rounded-lg border border-foreground/20 px-4 py-2 text-sm font-medium hover:bg-foreground/[0.04]"
            >
              Open class settings
            </Link>
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-foreground/10 bg-surface-elevated px-4 py-3">
          <p className="text-xs text-muted">Total registrations</p>
          <p className="text-2xl font-semibold tabular-nums">{summary.totalRegistrations}</p>
        </div>
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3">
          <p className="text-xs text-muted">Ready to assign</p>
          <p className="text-2xl font-semibold tabular-nums text-emerald-800 dark:text-emerald-200">
            {summary.assignable}
          </p>
        </div>
        <div className="rounded-xl border border-red-500/25 bg-red-500/5 px-4 py-3">
          <p className="text-xs text-muted">Unassigned · no match</p>
          <p className="text-2xl font-semibold tabular-nums text-red-800 dark:text-red-300">
            {summary.noMatch}
          </p>
        </div>
        <div className="rounded-xl border border-foreground/10 bg-surface-elevated px-4 py-3">
          <p className="text-xs text-muted">Already in a class</p>
          <p className="text-2xl font-semibold tabular-nums">{summary.alreadyAssigned}</p>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-900 dark:text-red-100 whitespace-pre-line">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-950 dark:text-emerald-100">
          {message}
        </div>
      ) : null}

      {assignableRows.length > 0 ? (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Proposed assignments</h2>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="text-sm text-brand underline"
                onClick={() => toggleAllAssignables(true)}
              >
                Select all
              </button>
              <button
                type="button"
                className="text-sm text-muted underline"
                onClick={() => toggleAllAssignables(false)}
              >
                Clear
              </button>
              <button
                type="button"
                disabled={pendingApply || selected.size === 0}
                onClick={applySelected}
                className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground disabled:opacity-50"
              >
                {pendingApply ? "Applying…" : `Approve selected (${selected.size})`}
              </button>
            </div>
          </div>
          <SimulationTable
            rows={assignableRows}
            selected={selected}
            onToggle={(id, checked) => {
              setSelected((prev) => {
                const next = new Set(prev);
                if (checked) next.add(id);
                else next.delete(id);
                return next;
              });
            }}
            showCheckbox
          />
        </section>
      ) : (
        <p className="rounded-xl border border-foreground/10 bg-surface-elevated px-4 py-6 text-center text-sm text-muted">
          No unassigned registrations would receive a class from the current rules.
        </p>
      )}

      {unmatchedRows.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Unassigned — no matching class</h2>
          <SimulationTable rows={unmatchedRows} selected={selected} onToggle={() => {}} />
        </section>
      ) : null}

      {assignedRows.length > 0 ? (
        <details className="rounded-xl border border-foreground/10 bg-surface-elevated px-4 py-3">
          <summary className="cursor-pointer text-sm font-medium text-foreground">
            Already assigned ({assignedRows.length})
          </summary>
          <div className="mt-3">
            <SimulationTable rows={assignedRows} selected={selected} onToggle={() => {}} />
          </div>
        </details>
      ) : null}
    </div>
  );
}

function SimulationTable({
  rows,
  selected,
  onToggle,
  showCheckbox = false,
}: {
  rows: AutoAssignSimulationRow[];
  selected: Set<string>;
  onToggle: (id: string, checked: boolean) => void;
  showCheckbox?: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-foreground/10">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="bg-foreground/[0.04] text-foreground/70">
          <tr>
            {showCheckbox ? <th className="w-10 px-3 py-2" /> : null}
            <th className="px-3 py-2 font-medium">Student</th>
            <th className="px-3 py-2 font-medium">Reg #</th>
            <th className="px-3 py-2 font-medium">DOB</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">Proposed class</th>
            <th className="px-3 py-2 font-medium">Result</th>
            <th className="px-3 py-2 font-medium">Notes</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.registrationId} className="border-t border-foreground/10">
              {showCheckbox ? (
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={selected.has(row.registrationId)}
                    onChange={(e) => onToggle(row.registrationId, e.target.checked)}
                    aria-label={`Select ${row.childName}`}
                  />
                </td>
              ) : null}
              <td className="px-3 py-2">
                <Link
                  href={`/registrations/${row.registrationId}`}
                  className="font-medium text-brand underline"
                >
                  {row.childName}
                </Link>
              </td>
              <td className="px-3 py-2 tabular-nums text-muted">{row.registrationNumber ?? "—"}</td>
              <td className="px-3 py-2 tabular-nums">{row.childDob}</td>
              <td className="px-3 py-2">{row.status}</td>
              <td className="px-3 py-2 font-medium">
                {row.proposedClassroomName ?? row.currentClassroomName ?? "—"}
              </td>
              <td className={`px-3 py-2 font-medium ${outcomeClass(row)}`}>{outcomeLabel(row)}</td>
              <td className="max-w-xs px-3 py-2 text-xs text-muted">{row.note ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
