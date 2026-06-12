"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  PAYMENT_STATUS_FIELD_KEY,
  PAYMENT_STATUS_OPTIONS,
  type CheckInBlockSettings,
} from "@/lib/check-in-block";
import type { ExportFieldOption } from "@/lib/registration-export";
import { saveCheckInSettings, type SaveCheckInSettingsState } from "./actions";

type Props = {
  seasonId: string;
  seasonName: string;
  multiDayCheckInEnabled: boolean;
  dismissalTrackingEnabled: boolean;
  checkInUndoPin: string | null;
  checkInBlock: CheckInBlockSettings;
  fieldOptions: ExportFieldOption[];
};

const initial: SaveCheckInSettingsState | null = null;

const CORE_FIELD_OPTIONS: ExportFieldOption[] = [
  { key: PAYMENT_STATUS_FIELD_KEY, label: "Payment status", group: "core" },
  { key: "status", label: "Registration status", group: "core" },
];

export function CheckInSettingsForm({
  seasonId,
  seasonName,
  multiDayCheckInEnabled,
  dismissalTrackingEnabled,
  checkInUndoPin,
  checkInBlock,
  fieldOptions,
}: Props) {
  const [state, action, pending] = useActionState(saveCheckInSettings.bind(null, seasonId), initial);
  const allFieldOptions = [...CORE_FIELD_OPTIONS, ...fieldOptions];

  return (
    <form action={action} className="space-y-6">
      <div className="rounded-xl border border-foreground/10 bg-surface-elevated p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground">Attendance tracking</h2>
        <p className="mt-1 text-sm text-muted">
          Configure how the check-in desk records arrivals for {seasonName}.
        </p>

        <label className="mt-4 flex cursor-pointer gap-3 rounded-lg border border-foreground/10 px-3 py-3 hover:bg-foreground/[0.02]">
          <input
            type="checkbox"
            name="multiDayCheckInEnabled"
            defaultChecked={multiDayCheckInEnabled}
            className="mt-0.5"
          />
          <span>
            <span className="block text-sm font-medium text-foreground">Multi-day check-in</span>
            <span className="mt-0.5 block text-xs text-muted">
              Track attendance separately for each camp day. Staff choose the active day at the check-in desk.
              Past days cannot be changed from the mobile app.
            </span>
          </span>
        </label>

        <label className="mt-3 flex cursor-pointer gap-3 rounded-lg border border-foreground/10 px-3 py-3 hover:bg-foreground/[0.02]">
          <input
            type="checkbox"
            name="dismissalTrackingEnabled"
            defaultChecked={dismissalTrackingEnabled}
            className="mt-0.5"
          />
          <span>
            <span className="block text-sm font-medium text-foreground">Arrivals &amp; dismissal modes</span>
            <span className="mt-0.5 block text-xs text-muted">
              Show separate <strong className="font-medium text-foreground/80">Arrivals</strong> and{" "}
              <strong className="font-medium text-foreground/80">Dismissal</strong> tabs on the iPad check-in app.
              When off, volunteers only check students in (undo is still available from the lookup flow).
            </span>
          </span>
        </label>
      </div>

      <div className="rounded-xl border border-foreground/10 bg-surface-elevated p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground">Check-in restrictions</h2>
        <p className="mt-1 text-sm text-muted">
          Block check-in when a registration matches certain field values (for example, payment still due).
        </p>

        <label className="mt-4 flex cursor-pointer gap-3 rounded-lg border border-foreground/10 px-3 py-3 hover:bg-foreground/[0.02]">
          <input
            type="checkbox"
            name="checkInBlockEnabled"
            defaultChecked={checkInBlock.enabled}
            className="mt-0.5"
          />
          <span>
            <span className="block text-sm font-medium text-foreground">Block check-in by field value</span>
            <span className="mt-0.5 block text-xs text-muted">
              Volunteers see your custom message instead of checking the student in.
            </span>
          </span>
        </label>

        <div className="mt-4 space-y-4 rounded-lg border border-foreground/10 bg-background/50 p-4">
          <label className="block text-sm">
            <span className="font-medium text-foreground">Field to check</span>
            <select
              name="checkInBlockFieldKey"
              defaultValue={checkInBlock.fieldKey}
              className="mt-1.5 w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm"
            >
              {allFieldOptions.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            <span className="font-medium text-foreground">Blocked values</span>
            <span className="mt-0.5 block text-xs text-muted">
              One value per line. Matching is case-insensitive. For payment status, use labels like{" "}
              <code className="rounded bg-foreground/5 px-1">Due</code> or{" "}
              <code className="rounded bg-foreground/5 px-1">Checkout pending</code>.
            </span>
            <textarea
              name="checkInBlockValues"
              rows={4}
              defaultValue={checkInBlock.blockedValues.join("\n")}
              placeholder={"Due\nCheckout pending"}
              className="mt-1.5 w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 font-mono text-sm"
            />
            {checkInBlock.fieldKey === PAYMENT_STATUS_FIELD_KEY ? (
              <p className="mt-2 text-xs text-muted">
                Payment status options: {PAYMENT_STATUS_OPTIONS.join(", ")}
              </p>
            ) : null}
          </label>

          <label className="block text-sm">
            <span className="font-medium text-foreground">Message shown to volunteers</span>
            <textarea
              name="checkInBlockMessage"
              rows={3}
              defaultValue={checkInBlock.message}
              className="mt-1.5 w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm"
            />
          </label>
        </div>
      </div>

      <div className="rounded-xl border border-foreground/10 bg-surface-elevated p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground">Undo check-in security</h2>
        <p className="mt-1 text-sm text-muted">
          When set, staff must enter this 4-digit code to undo a check-in on the web desk or iPad app.
        </p>

        <label className="mt-4 block text-sm">
          <span className="font-medium text-foreground">Security code (4 digits)</span>
          <input
            type="password"
            name="checkInUndoPin"
            inputMode="numeric"
            pattern="\d{4}"
            maxLength={4}
            autoComplete="off"
            defaultValue={checkInUndoPin ?? ""}
            placeholder="Leave blank to disable"
            className="mt-1.5 w-full max-w-[8rem] rounded-lg border border-foreground/15 bg-background px-3 py-2 font-mono text-sm tracking-widest sm:max-w-xs"
          />
          <span className="mt-1 block text-xs text-muted">
            Leave empty to allow undo without a code. Dismissal check-out is not affected.
          </span>
        </label>
      </div>

      {state ? (
        <p
          className={`text-sm ${state.ok ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"}`}
          role="status"
        >
          {state.message}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-foreground hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save settings"}
        </button>
        <Link href="/seasons" className="text-sm font-medium text-brand underline-offset-4 hover:underline">
          Back to seasons
        </Link>
      </div>
    </form>
  );
}
