"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Camera, Search } from "lucide-react";
import { printBadgeByRegistrationId } from "@/components/badge-print/print-badge-button";
import { CheckInLookupResultModal } from "@/components/check-in/check-in-lookup-result-modal";
import { CheckInQrScanner } from "@/components/check-in/check-in-qr-scanner";
import { UndoCheckInPinModal } from "@/components/check-in/undo-check-in-pin-modal";
import { PrintBadgeButton } from "@/components/badge-print/print-badge-button";
import type { CampDateOption } from "@/lib/camp-date";
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
  multiDayCheckInEnabled: boolean;
  undoPinRequired: boolean;
  campDates: CampDateOption[];
  selectedCampDate: string;
  /** Super admins may browse past camp days (read-only). */
  allowPastCampDates?: boolean;
};

export function CheckInDeskClient({
  seasonId,
  rows,
  badgePrintingEnabled,
  autoPrintOnCheckIn,
  multiDayCheckInEnabled,
  undoPinRequired,
  campDates,
  selectedCampDate,
  allowPastCampDates = false,
}: Props) {
  const router = useRouter();
  const campDate = selectedCampDate;
  const selectedDay = campDates.find((d) => d.key === campDate);
  const isPastDay = Boolean(selectedDay?.isPast);
  const checkInDisabled = isPastDay;
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lookupQuery, setLookupQuery] = useState("");
  const [lookupPending, startLookupTransition] = useTransition();
  const [lookupMessage, setLookupMessage] = useState<string | null>(null);
  const [lookupModalOpen, setLookupModalOpen] = useState(false);
  const [lookupMatches, setLookupMatches] = useState<CheckInLookupMatch[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [nameFilter, setNameFilter] = useState("");
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [pendingUndo, setPendingUndo] = useState<{
    registrationId: string;
    nextChecked: boolean;
    onSuccess: () => void;
    pendingRegistrationId: string;
  } | null>(null);
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

  function closeLookupModal() {
    setLookupModalOpen(false);
    setLookupMatches([]);
    setSelectedMatchId(null);
  }

  function openLookupResults(matches: CheckInLookupMatch[]) {
    setLookupMatches(matches);
    setSelectedMatchId(matches.length === 1 ? matches[0]!.id : null);
    setLookupModalOpen(true);
  }

  function runLookup(rawInput: string) {
    const value = rawInput.trim();
    if (!value) {
      setLookupMessage("Enter a name, registration code, or scan a QR code.");
      closeLookupModal();
      return;
    }
    setLookupQuery(value);
    setLookupMessage(null);
    setError(null);

    startLookupTransition(async () => {
      const result = await lookupRegistrationForCheckIn(seasonId, value, campDate);
      if (!result.ok) {
        closeLookupModal();
        setLookupMessage(result.message);
        return;
      }
      openLookupResults(result.matches);
    });
  }

  function requestUndo(
    registrationId: string,
    onSuccess: () => void,
    pendingRegistrationId: string,
  ) {
    if (undoPinRequired) {
      setPendingUndo({
        registrationId,
        nextChecked: false,
        onSuccess,
        pendingRegistrationId,
      });
      setPinModalOpen(true);
      return;
    }
    performToggle(registrationId, false, null, onSuccess, pendingRegistrationId);
  }

  function handleCheckInFromModal(match: CheckInLookupMatch) {
    const nextChecked = !match.checkedIn;
    if (!nextChecked) {
      requestUndo(match.id, () => {
        setLookupMatches((prev) =>
          prev.map((m) => (m.id === match.id ? { ...m, checkedIn: false } : m)),
        );
      }, match.id);
      return;
    }
    performToggleFromModal(match, nextChecked);
  }

  function performToggleFromModal(match: CheckInLookupMatch, nextChecked: boolean) {
    performToggle(match.id, nextChecked, null, () => {
      setLookupMatches((prev) =>
        prev.map((m) => (m.id === match.id ? { ...m, checkedIn: nextChecked } : m)),
      );
      if (nextChecked) {
        closeLookupModal();
        setLookupQuery("");
      }
    }, match.id);
  }

  function performToggle(
    registrationId: string,
    nextChecked: boolean,
    undoPin: string | null,
    onSuccess: () => void,
    pendingRegistrationId: string,
  ) {
    setPendingId(pendingRegistrationId);
    setError(null);
    startTransition(async () => {
      try {
        const result = await toggleCheckIn(registrationId, nextChecked, campDate, undoPin);
        if (!result.ok) {
          setError(result.message);
          return;
        }

        onSuccess();
        router.refresh();

        if (result.shouldPrintBadge && badgePrintingEnabled) {
          try {
            await printBadgeByRegistrationId(registrationId);
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

  function handleToggle(row: CheckInRow) {
    const nextChecked = !row.checkedIn;
    if (!nextChecked) {
      requestUndo(row.id, () => {}, row.id);
      return;
    }
    performToggle(row.id, nextChecked, null, () => {}, row.id);
  }

  function handlePinSubmit(pin: string) {
    const pending = pendingUndo;
    setPinModalOpen(false);
    setPendingUndo(null);
    if (!pending) return;
    performToggle(
      pending.registrationId,
      pending.nextChecked,
      pin,
      pending.onSuccess,
      pending.pendingRegistrationId,
    );
  }

  function closePinModal() {
    setPinModalOpen(false);
    setPendingUndo(null);
  }

  return (
    <div className="space-y-4">
      {multiDayCheckInEnabled || allowPastCampDates ? (
        campDates.length > 0 ? (
        <div className="rounded-xl border border-foreground/10 bg-surface-elevated p-4 shadow-sm">
          <label className="block text-sm">
            <span className="font-semibold text-foreground">Camp day</span>
            <select
              value={campDate}
              onChange={(e) => {
                router.push(`/check-in?campDate=${encodeURIComponent(e.target.value)}`);
              }}
              className="mt-2 w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm sm:max-w-sm"
            >
              {campDates.map((day) => (
                <option
                  key={day.key}
                  value={day.key}
                  disabled={day.isPast && !allowPastCampDates}
                >
                  {day.label}
                  {day.isToday ? " (today)" : ""}
                  {day.isPast ? " (past)" : ""}
                </option>
              ))}
            </select>
          </label>
          {isPastDay && allowPastCampDates ? (
            <p className="mt-2 text-sm text-muted">
              Viewing a past camp day — check-in counts are read-only for super admins.
            </p>
          ) : isPastDay ? (
            <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">
              Past camp days are read-only. Switch to today to check students in or out.
            </p>
          ) : null}
        </div>
        ) : null
      ) : null}

      <div className="rounded-xl border border-foreground/10 bg-surface-elevated p-4 shadow-sm">
        <h2 className="text-sm font-semibold">Find registration</h2>
        <p className="mt-1 text-xs text-muted">
          Scan a ticket or badge QR code, or search by child name, registration number (e.g. IPC--001), or family
          submission code.
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
            placeholder="Name, registration # (IPC--001), or submission code"
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
      </div>

      <CheckInQrScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={(text) => runLookup(text)}
      />

      <CheckInLookupResultModal
        open={lookupModalOpen}
        matches={lookupMatches}
        pendingId={pendingId}
        badgePrintingEnabled={badgePrintingEnabled}
        checkInDisabled={checkInDisabled}
        onClose={closeLookupModal}
        onCheckIn={handleCheckInFromModal}
        onSelectMatch={(match) => setSelectedMatchId(match.id)}
        selectedMatchId={selectedMatchId}
      />

      <UndoCheckInPinModal
        open={pinModalOpen}
        onClose={closePinModal}
        onSubmit={handlePinSubmit}
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
                            disabled={isPending || checkInDisabled}
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
