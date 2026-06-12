"use client";

import { CheckCircle2, X } from "lucide-react";
import { PrintBadgeButton } from "@/components/badge-print/print-badge-button";
import type { CheckInLookupMatch } from "@/lib/check-in-lookup";

type Props = {
  open: boolean;
  matches: CheckInLookupMatch[];
  pendingId: string | null;
  badgePrintingEnabled: boolean;
  checkInDisabled?: boolean;
  onClose: () => void;
  onCheckIn: (match: CheckInLookupMatch) => void;
  onSelectMatch?: (match: CheckInLookupMatch) => void;
  selectedMatchId?: string | null;
};

function MatchSummary({ match }: { match: CheckInLookupMatch }) {
  return (
    <dl className="mt-4 space-y-2 text-sm">
      <div className="flex justify-between gap-4">
        <dt className="text-muted">Class</dt>
        <dd className="font-medium text-foreground">{match.className}</dd>
      </div>
      {match.registrationNumber ? (
        <div className="flex justify-between gap-4">
          <dt className="text-muted">Registration #</dt>
          <dd className="font-mono font-medium text-foreground">{match.registrationNumber}</dd>
        </div>
      ) : null}
      {match.submissionCode ? (
        <div className="flex justify-between gap-4">
          <dt className="text-muted">Family code</dt>
          <dd className="font-mono text-foreground">{match.submissionCode}</dd>
        </div>
      ) : null}
      {match.guardianName ? (
        <div className="flex justify-between gap-4">
          <dt className="text-muted">Guardian</dt>
          <dd className="text-right font-medium text-foreground">{match.guardianName}</dd>
        </div>
      ) : null}
      {match.dateOfBirth ? (
        <div className="flex justify-between gap-4">
          <dt className="text-muted">Date of birth</dt>
          <dd className="font-medium text-foreground">{match.dateOfBirth}</dd>
        </div>
      ) : null}
      {match.allergiesNotes ? (
        <div>
          <dt className="text-muted">Medical / allergies</dt>
          <dd className="mt-1 rounded-md bg-amber-500/10 px-2.5 py-2 text-foreground">{match.allergiesNotes}</dd>
        </div>
      ) : null}
      <div className="flex justify-between gap-4">
        <dt className="text-muted">Registration status</dt>
        <dd className="font-medium text-foreground">{match.registrationStatus}</dd>
      </div>
      <div className="flex justify-between gap-4">
        <dt className="text-muted">Check-in</dt>
        <dd>
          {match.checkedIn ? (
            <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-800 dark:text-emerald-300">
              Already checked in
            </span>
          ) : match.checkInBlocked ? (
            <span className="inline-flex items-center rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-medium text-amber-900 dark:text-amber-200">
              Blocked
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-foreground/10 px-2.5 py-0.5 text-xs font-medium text-muted">
              Expected today
            </span>
          )}
        </dd>
      </div>
      {match.checkInBlocked && !match.checkedIn && match.checkInBlockMessage ? (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-2 text-sm text-amber-900 dark:text-amber-100">
          {match.checkInBlockMessage}
        </div>
      ) : null}
    </dl>
  );
}

export function CheckInLookupResultModal({
  open,
  matches,
  pendingId,
  badgePrintingEnabled,
  checkInDisabled = false,
  onClose,
  onCheckIn,
  onSelectMatch,
  selectedMatchId,
}: Props) {
  if (!open || matches.length === 0) return null;

  const activeMatch =
    matches.find((m) => m.id === selectedMatchId) ?? (matches.length === 1 ? matches[0]! : null);
  const isPending = activeMatch ? pendingId === activeMatch.id : false;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <div
        className="w-full max-w-md overflow-hidden rounded-xl bg-background shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="check-in-lookup-title"
      >
        <div className="flex items-start justify-between border-b border-foreground/10 px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-full bg-emerald-500/15 p-2 text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="size-5" aria-hidden />
            </div>
            <div>
              <h2 id="check-in-lookup-title" className="text-base font-semibold text-foreground">
                Registration found
              </h2>
              <p className="mt-0.5 text-sm text-muted">
                {matches.length > 1 && !activeMatch
                  ? "Multiple children match that code. Select one to continue."
                  : "Review the details below, then check in when ready."}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 hover:bg-foreground/5"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
          {matches.length > 1 && !activeMatch ? (
            <ul className="space-y-2">
              {matches.map((match) => (
                <li key={match.id}>
                  <button
                    type="button"
                    onClick={() => onSelectMatch?.(match)}
                    className="w-full rounded-lg border border-foreground/10 px-3 py-3 text-left hover:border-brand/40 hover:bg-brand/5"
                  >
                    <p className="font-semibold text-foreground">{match.studentName}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {match.className}
                      {match.registrationNumber ? ` · ${match.registrationNumber}` : ""}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          ) : activeMatch ? (
            <>
              <p className="text-xl font-bold text-foreground">{activeMatch.studentName}</p>
              <MatchSummary match={activeMatch} />
            </>
          ) : null}
        </div>

        {activeMatch ? (
          <div className="flex flex-col gap-2 border-t border-foreground/10 px-5 py-4 sm:flex-row sm:justify-end">
            {badgePrintingEnabled ? (
              <PrintBadgeButton registrationId={activeMatch.id} compact label="Print badge" />
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-foreground/15 px-4 py-2.5 text-sm font-medium hover:bg-foreground/5"
            >
              Close
            </button>
            <button
              type="button"
              disabled={
                isPending ||
                checkInDisabled ||
                Boolean(activeMatch.checkInBlocked && !activeMatch.checkedIn)
              }
              onClick={() => onCheckIn(activeMatch)}
              className={
                activeMatch.checkedIn
                  ? "rounded-lg border border-foreground/15 px-4 py-2.5 text-sm font-medium hover:bg-foreground/5 disabled:opacity-50"
                  : "rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-brand-foreground hover:opacity-90 disabled:opacity-50"
              }
            >
              {isPending ? "Updating…" : activeMatch.checkedIn ? "Undo check-in" : "Check in"}
            </button>
          </div>
        ) : (
          <div className="border-t border-foreground/10 px-5 py-4">
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-lg border border-foreground/15 px-4 py-2.5 text-sm font-medium hover:bg-foreground/5"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
