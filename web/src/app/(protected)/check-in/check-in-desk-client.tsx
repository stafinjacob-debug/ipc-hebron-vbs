"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { PrintBadgeButton, printBadgeByRegistrationId } from "@/components/badge-print/print-badge-button";
import { toggleCheckIn } from "./actions";

export type CheckInRow = {
  id: string;
  studentName: string;
  className: string;
  checkedIn: boolean;
};

type Props = {
  rows: CheckInRow[];
  badgePrintingEnabled: boolean;
  autoPrintOnCheckIn: boolean;
};

export function CheckInDeskClient({ rows, badgePrintingEnabled, autoPrintOnCheckIn }: Props) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function handleToggle(row: CheckInRow) {
    setPendingId(row.id);
    setError(null);
    startTransition(async () => {
      try {
        const result = await toggleCheckIn(row.id, !row.checkedIn);
        if (!result.ok) {
          setError(result.message);
          return;
        }
        router.refresh();
        if (result.shouldPrintBadge && badgePrintingEnabled) {
          try {
            await printBadgeByRegistrationId(row.id);
          } catch (printErr) {
            setError(printErr instanceof Error ? printErr.message : "Badge print failed.");
          }
        }
      } catch {
        setError("Check-in update failed.");
      } finally {
        setPendingId(null);
      }
    });
  }

  return (
    <div className="space-y-3">
      {error ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-800 dark:text-red-200">
          {error}
        </div>
      ) : null}
      <div className="overflow-hidden rounded-xl border border-foreground/10 bg-surface-elevated shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-foreground/10 bg-foreground/[0.03] text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Student</th>
              <th className="px-4 py-3 font-medium">Class</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isPending = pendingId === row.id;
              return (
                <tr key={row.id} className="border-t border-foreground/10">
                  <td className="px-4 py-3 font-medium">{row.studentName}</td>
                  <td className="px-4 py-3 text-muted">{row.className}</td>
                  <td className="px-4 py-3">
                    {row.checkedIn ? (
                      <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-800 dark:text-emerald-300">
                        Checked in
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-foreground/10 px-2.5 py-0.5 text-xs font-medium text-muted">
                        Expected
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {badgePrintingEnabled ? (
                        <PrintBadgeButton registrationId={row.id} compact label="Print" />
                      ) : null}
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleToggle(row)}
                        className={
                          row.checkedIn
                            ? "rounded-lg border border-foreground/15 px-3 py-1.5 text-xs font-medium hover:bg-foreground/5 disabled:opacity-50"
                            : "rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-brand-foreground hover:opacity-90 disabled:opacity-50"
                        }
                      >
                        {isPending ? "…" : row.checkedIn ? "Undo" : "Check in"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {badgePrintingEnabled && autoPrintOnCheckIn ? (
        <p className="text-xs text-muted">
          Auto-print is on — the print dialog opens after each check-in. Select your thermal printer on the iPad.
        </p>
      ) : null}
    </div>
  );
}
