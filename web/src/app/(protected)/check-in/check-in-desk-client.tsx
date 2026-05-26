"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { Camera, Search } from "lucide-react";
import { PrintBadgeButton, printBadgeByRegistrationId } from "@/components/badge-print/print-badge-button";
import { CheckInQrScanner } from "@/components/check-in/check-in-qr-scanner";
import type { CheckInLookupMatch } from "@/lib/check-in-lookup";
import { lookupRegistrationForCheckIn, toggleCheckIn } from "./actions";

export type CheckInRow = {
  id: string;
  studentName: string;
  className: string;
  checkedIn: boolean;
  registrationNumber?: string | null;
  submissionCode?: string | null;
};

type Props = {
  seasonId: string;
  rows: CheckInRow[];
  badgePrintingEnabled: boolean;
  autoPrintOnCheckIn: boolean;
};

export function CheckInDeskClient({ seasonId, rows, badgePrintingEnabled, autoPrintOnCheckIn }: Props) {
  const router = useRouter();
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lookupQuery, setLookupQuery] = useState("");
  const [lookupPending, startLookupTransition] = useTransition();
  const [lookupMatches, setLookupMatches] = useState<CheckInLookupMatch[] | null>(null);
  const [lookupMessage, setLookupMessage] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [nameFilter, setNameFilter] = useState("");
  const [, startTransition] = useTransition();

  const filteredRows = useMemo(() => {
    const q = nameFilter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.studentName.toLowerCase().includes(q) ||
        r.className.toLowerCase().includes(q) ||
        (r.registrationNumber ?? "").toLowerCase().includes(q) ||
        (r.submissionCode ?? "").toLowerCase().includes(q),
    );
  }, [rows, nameFilter]);

  function focusRegistration(registrationId: string) {
    setHighlightId(registrationId);
    const el = rowRefs.current[registrationId];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  function runLookup(rawInput: string) {
    const value = rawInput.trim();
    if (!value) {
      setLookupMessage("Enter a registration code or scan a QR code.");
      setLookupMatches(null);
      return;
    }
    setLookupQuery(value);
    setLookupMessage(null);
    setLookupMatches(null);
    setError(null);

    startLookupTransition(async () => {
      const result = await lookupRegistrationForCheckIn(seasonId, value);
      if (!result.ok) {
        setLookupMessage(result.message);
        setLookupMatches(null);
        return;
      }
      setLookupMatches(result.matches);
      if (result.matches.length === 1) {
        focusRegistration(result.matches[0]!.id);
      }
    });
  }

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

  function renderMatchActions(match: CheckInLookupMatch) {
    const row: CheckInRow = {
      id: match.id,
      studentName: match.studentName,
      className: match.className,
      checkedIn: match.checkedIn,
      registrationNumber: match.registrationNumber,
      submissionCode: match.submissionCode,
    };
    const isPending = pendingId === match.id;
    return (
      <div className="flex flex-wrap items-center gap-2">
        {badgePrintingEnabled ? <PrintBadgeButton registrationId={match.id} compact label="Print" /> : null}
        <button
          type="button"
          disabled={isPending}
          onClick={() => handleToggle(row)}
          className={
            match.checkedIn
              ? "rounded-lg border border-foreground/15 px-3 py-1.5 text-xs font-medium hover:bg-foreground/5 disabled:opacity-50"
              : "rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-brand-foreground hover:opacity-90 disabled:opacity-50"
          }
        >
          {isPending ? "…" : match.checkedIn ? "Undo check-in" : "Check in"}
        </button>
        <button
          type="button"
          className="rounded-lg border border-foreground/15 px-3 py-1.5 text-xs font-medium hover:bg-foreground/5"
          onClick={() => focusRegistration(match.id)}
        >
          Show in list
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-foreground/10 bg-surface-elevated p-4 shadow-sm">
        <h2 className="text-sm font-semibold">Find registration</h2>
        <p className="mt-1 text-xs text-muted">
          Scan a ticket or badge QR code, or type a registration number / family submission code.
        </p>
        <form
          className="mt-3 flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            runLookup(lookupQuery);
          }}
        >
          <input
            type="text"
            value={lookupQuery}
            onChange={(e) => setLookupQuery(e.target.value)}
            placeholder="Registration code, e.g. VBS-2026-001"
            className="min-w-0 flex-1 rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm"
            autoComplete="off"
            spellCheck={false}
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={lookupPending}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-foreground hover:opacity-90 disabled:opacity-50 sm:flex-none"
            >
              <Search className="size-4" aria-hidden />
              {lookupPending ? "Looking…" : "Look up"}
            </button>
            <button
              type="button"
              onClick={() => setScannerOpen(true)}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-foreground/15 px-4 py-2 text-sm font-medium hover:bg-foreground/5 sm:flex-none"
            >
              <Camera className="size-4" aria-hidden />
              Scan QR
            </button>
          </div>
        </form>
        {lookupMessage ? (
          <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
            {lookupMessage}
          </p>
        ) : null}
        {lookupMatches && lookupMatches.length === 1 ? (
          <div className="mt-3 rounded-lg border border-brand/30 bg-brand/5 p-3">
            <p className="text-sm font-semibold">{lookupMatches[0]!.studentName}</p>
            <p className="mt-0.5 text-xs text-muted">
              {lookupMatches[0]!.className}
              {lookupMatches[0]!.registrationNumber
                ? ` · Reg # ${lookupMatches[0]!.registrationNumber}`
                : ""}
            </p>
            <div className="mt-3">{renderMatchActions(lookupMatches[0]!)}</div>
          </div>
        ) : null}
        {lookupMatches && lookupMatches.length > 1 ? (
          <div className="mt-3 space-y-2">
            <p className="text-xs font-medium text-muted">
              Multiple children share that family code — choose one:
            </p>
            {lookupMatches.map((match) => (
              <div
                key={match.id}
                className="rounded-lg border border-foreground/10 bg-background px-3 py-2.5"
              >
                <p className="text-sm font-semibold">{match.studentName}</p>
                <p className="text-xs text-muted">
                  {match.className}
                  {match.registrationNumber ? ` · Reg # ${match.registrationNumber}` : ""}
                </p>
                <div className="mt-2">{renderMatchActions(match)}</div>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <CheckInQrScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={(text) => runLookup(text)}
      />

      {error ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-800 dark:text-red-200">
          {error}
        </div>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted">
          {filteredRows.length} of {rows.length} registrations
        </p>
        <input
          type="search"
          value={nameFilter}
          onChange={(e) => setNameFilter(e.target.value)}
          placeholder="Filter by name, class, or code…"
          className="w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm sm:max-w-xs"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-foreground/10 bg-surface-elevated shadow-sm">
        {rows.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <p className="font-medium text-foreground">No registrations for this season yet</p>
            <p className="mt-2 text-sm text-muted">
              When families register, use the lookup above to scan their QR code or enter their code.
            </p>
          </div>
        ) : (
          <>
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
            {filteredRows.map((row) => {
              const isPending = pendingId === row.id;
              const highlighted = highlightId === row.id;
              return (
                <tr
                  key={row.id}
                  ref={(el) => {
                    rowRefs.current[row.id] = el;
                  }}
                  className={
                    highlighted
                      ? "border-t border-brand/30 bg-brand/10 ring-1 ring-inset ring-brand/30"
                      : "border-t border-foreground/10"
                  }
                >
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
            {filteredRows.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted">No registrations match your filter.</p>
            ) : null}
          </>
        )}
      </div>

      {badgePrintingEnabled && autoPrintOnCheckIn ? (
        <p className="text-xs text-muted">
          Auto-print is on — the print dialog opens after each check-in. Select your thermal printer on the iPad.
        </p>
      ) : null}
    </div>
  );
}
