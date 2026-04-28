"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { approveRegistration, deleteRegistrationRecord } from "./registration-actions";

export type RegistrationBulkTableRow = {
  id: string;
  status: string;
  registrationNumber: string | null;
  childFirstName: string;
  childLastName: string;
  guardianEmail: string | null;
  seasonName: string;
  classroomName: string | null;
  registeredAtIso: string;
  paymentBadgeLabel: string;
  paymentBadgeClassName: string;
};

function linkForPage(baseQs: string, p: number) {
  const q = new URLSearchParams(baseQs);
  if (p > 1) q.set("page", String(p));
  else q.delete("page");
  const s = q.toString();
  return s ? `/registrations?${s}` : "/registrations";
}

function PaginationBar({
  baseQueryString,
  page,
  totalPages,
  hasNextPage,
}: {
  baseQueryString: string;
  page: number;
  totalPages: number;
  hasNextPage: boolean;
}) {
  const pageLinkNums = useMemo(() => {
    const tp = totalPages;
    if (tp <= 1) return [1];
    if (tp <= 7) return Array.from({ length: tp }, (_, i) => i + 1);

    const nums = new Set<number>([1, tp]);
    const windowStart = Math.max(2, page - 1);
    const windowEnd = Math.min(tp - 1, page + 1);
    for (let p = windowStart; p <= windowEnd; p++) nums.add(p);
    return [...nums].sort((a, b) => a - b);
  }, [page, totalPages]);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-foreground/10 px-4 py-2 text-xs text-foreground/65">
      <span className="tabular-nums">
        Page {page} of {totalPages}
      </span>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {page > 1 ? (
          <Link
            href={linkForPage(baseQueryString, page - 1)}
            className="rounded-md border border-foreground/15 px-2 py-1 text-xs font-medium hover:bg-foreground/[0.04]"
          >
            Prev
          </Link>
        ) : (
          <span className="rounded-md border border-transparent px-2 py-1 text-xs text-foreground/35">Prev</span>
        )}
        <div className="flex flex-wrap items-center gap-1">
          {pageLinkNums.map((p, idx) => {
            const prev = pageLinkNums[idx - 1];
            const showGap = idx > 0 && prev != null && p - prev > 1;
            const isCurrent = p === page;
            return (
              <span key={p} className="inline-flex items-center gap-1">
                {showGap ? <span className="px-1 text-foreground/35">…</span> : null}
                {isCurrent ? (
                  <span className="rounded-md border border-foreground/25 bg-foreground/[0.06] px-2 py-1 text-xs font-semibold text-foreground">
                    {p}
                  </span>
                ) : (
                  <Link
                    href={linkForPage(baseQueryString, p)}
                    className="rounded-md border border-foreground/15 px-2 py-1 text-xs font-medium hover:bg-foreground/[0.04]"
                  >
                    {p === 1 ? "Page 1" : p}
                  </Link>
                )}
              </span>
            );
          })}
        </div>
        {hasNextPage ? (
          <Link
            href={linkForPage(baseQueryString, page + 1)}
            className="rounded-md border border-foreground/15 px-2 py-1 text-xs font-medium hover:bg-foreground/[0.04]"
          >
            Next
          </Link>
        ) : (
          <span className="rounded-md border border-transparent px-2 py-1 text-xs text-foreground/35">Next</span>
        )}
      </div>
    </div>
  );
}

function canApproveStatus(status: string) {
  return status === "PENDING" || status === "WAITLIST" || status === "DRAFT";
}

export function RegistrationsBulkTable({
  rows,
  canBulkAct,
  baseQueryString,
  page,
  totalPages,
  hasNextPage,
  selectionResetKey,
}: {
  rows: RegistrationBulkTableRow[];
  canBulkAct: boolean;
  baseQueryString: string;
  page: number;
  totalPages: number;
  hasNextPage: boolean;
  /** Change when filters/page dataset changes so selection clears. */
  selectionResetKey: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(() => new Set());

  const rowById = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);
  const pageIds = useMemo(() => rows.map((r) => r.id), [rows]);

  useEffect(() => {
    setSelected(new Set());
  }, [selectionResetKey]);

  const toggleOne = useCallback((id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const selectAllOnPage = useCallback(() => {
    setSelected(new Set(pageIds));
  }, [pageIds]);

  const clearSelection = useCallback(() => setSelected(new Set()), []);

  const headerCheckboxState = useMemo(() => {
    if (pageIds.length === 0) return { checked: false, indeterminate: false };
    const onPage = pageIds.filter((id) => selected.has(id)).length;
    return {
      checked: onPage === pageIds.length,
      indeterminate: onPage > 0 && onPage < pageIds.length,
    };
  }, [pageIds, selected]);

  const toggleHeader = useCallback(() => {
    if (headerCheckboxState.checked) clearSelection();
    else selectAllOnPage();
  }, [headerCheckboxState.checked, clearSelection, selectAllOnPage]);

  const runBulkApprove = useCallback(() => {
    if (selected.size === 0) {
      window.alert("Select at least one registration.");
      return;
    }
    const ids = Array.from(selected);
    const approvable = ids.filter((id) => {
      const row = rowById.get(id);
      return row && canApproveStatus(row.status);
    });
    if (approvable.length === 0) {
      window.alert("None of the selected rows can be approved (only Pending, Waitlist, or Draft).");
      return;
    }
    const skipped = ids.filter((id) => !approvable.includes(id));
    startTransition(async () => {
      const lines: string[] = [];
      for (const id of approvable) {
        const row = rowById.get(id);
        const label = row ? `${row.childFirstName} ${row.childLastName}` : id;
        const r = await approveRegistration(id);
        lines.push(`${label}: ${r.ok ? "OK — " : ""}${r.message}`);
      }
      if (skipped.length > 0) {
        lines.push(
          `\nSkipped (${skipped.length}): not Pending / Waitlist / Draft — use View to handle individually.`,
        );
      }
      window.alert(lines.join("\n"));
      router.refresh();
    });
  }, [selected, rowById, router]);

  const runBulkDelete = useCallback(() => {
    if (selected.size === 0) {
      window.alert("Select at least one registration.");
      return;
    }
    const ids = Array.from(selected);
    const labels = ids.map((id) => {
      const row = rowById.get(id);
      return row ? `${row.childFirstName} ${row.childLastName}` : id;
    });
    if (
      !window.confirm(
        `Permanently delete ${ids.length} registration(s)? This cannot be undone. Guardians are not notified automatically.\n\n${labels.slice(0, 12).join(", ")}${labels.length > 12 ? "…" : ""}`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      const lines: string[] = [];
      for (const id of ids) {
        const row = rowById.get(id);
        const label = row ? `${row.childFirstName} ${row.childLastName}` : id;
        const r = await deleteRegistrationRecord(id);
        lines.push(`${label}: ${r.ok ? "Removed." : r.message}`);
      }
      window.alert(lines.join("\n"));
      router.refresh();
    });
  }, [selected, rowById, router]);

  return (
    <div className="overflow-hidden rounded-xl border border-foreground/10">
      {canBulkAct ? (
        <div className="flex flex-col gap-3 border-b border-foreground/10 bg-foreground/[0.03] px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2 text-sm text-foreground/80">
            <span className="font-medium tabular-nums">{selected.size} selected</span>
            <span className="text-foreground/40">·</span>
            <button
              type="button"
              disabled={pending || pageIds.length === 0}
              className="rounded-md border border-foreground/15 bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-foreground/[0.04] disabled:opacity-40"
              onClick={selectAllOnPage}
            >
              Select all on page
            </button>
            <button
              type="button"
              disabled={pending || selected.size === 0}
              className="rounded-md border border-foreground/15 bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-foreground/[0.04] disabled:opacity-40"
              onClick={clearSelection}
            >
              Clear selection
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={pending || selected.size === 0}
              title="Confirm selected rows, assign tickets if needed, send confirmation emails"
              className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 dark:bg-emerald-700"
              onClick={runBulkApprove}
            >
              Approve & notify
            </button>
            <button
              type="button"
              disabled={pending || selected.size === 0}
              title="Permanently remove selected registrations"
              className="rounded-md border border-red-400 bg-background px-3 py-2 text-sm font-medium text-red-800 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-200 dark:hover:bg-red-950/40"
              onClick={runBulkDelete}
            >
              Reject & delete
            </button>
          </div>
        </div>
      ) : null}

      <div className="border-b border-foreground/10">
        <PaginationBar
          baseQueryString={baseQueryString}
          page={page}
          totalPages={totalPages}
          hasNextPage={hasNextPage}
        />
      </div>

      <table className="w-full text-left text-sm">
        <thead className="bg-foreground/[0.04] text-foreground/70">
          <tr>
            {canBulkAct ? (
              <th className="w-10 px-2 py-3">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-foreground/30"
                  checked={headerCheckboxState.checked}
                  ref={(el) => {
                    if (el) el.indeterminate = headerCheckboxState.indeterminate;
                  }}
                  onChange={toggleHeader}
                  disabled={pending || pageIds.length === 0}
                  aria-label="Select all registrations on this page"
                />
              </th>
            ) : null}
            <th className="px-4 py-3 font-medium">Child</th>
            <th className="px-4 py-3 font-medium">Reg #</th>
            <th className="px-4 py-3 font-medium">Season</th>
            <th className="px-4 py-3 font-medium">Class</th>
            <th className="px-4 py-3 font-medium">Class assignment status</th>
            <th className="px-4 py-3 font-medium">Payment</th>
            <th className="px-4 py-3 font-medium">Registered</th>
            <th className="px-4 py-3 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const registeredLabel = new Date(r.registeredAtIso).toLocaleString();
            return (
              <tr key={r.id} className="border-t border-foreground/10">
                {canBulkAct ? (
                  <td className="px-2 py-3 align-top">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-foreground/30"
                      checked={selected.has(r.id)}
                      onChange={(e) => toggleOne(r.id, e.target.checked)}
                      disabled={pending}
                      aria-label={`Select ${r.childFirstName} ${r.childLastName}`}
                    />
                  </td>
                ) : null}
                <td className="px-4 py-3">
                  {r.childFirstName} {r.childLastName}
                  {r.guardianEmail ? (
                    <span className="mt-0.5 block text-xs text-foreground/50">{r.guardianEmail}</span>
                  ) : null}
                </td>
                <td className="px-4 py-3 font-mono text-xs font-medium text-foreground/90">
                  {r.registrationNumber ?? "Pending approval"}
                </td>
                <td className="px-4 py-3">{r.seasonName}</td>
                <td className="px-4 py-3 text-foreground/80">{r.classroomName ?? "—"}</td>
                <td className="px-4 py-3">{r.status}</td>
                <td className="px-4 py-3">
                  <span className={r.paymentBadgeClassName}>{r.paymentBadgeLabel}</span>
                </td>
                <td className="px-4 py-3 text-foreground/70">{registeredLabel}</td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/registrations/${r.id}`}
                    className="font-medium text-brand underline hover:no-underline"
                  >
                    View
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {rows.length === 0 && (
        <p className="px-4 py-8 text-center text-foreground/60">No registrations yet.</p>
      )}

      <div className="border-t border-foreground/10">
        <PaginationBar
          baseQueryString={baseQueryString}
          page={page}
          totalPages={totalPages}
          hasNextPage={hasNextPage}
        />
      </div>
    </div>
  );
}
