"use client";

import { useActionState } from "react";
import Link from "next/link";
import { saveCheckInSettings, type SaveCheckInSettingsState } from "./actions";

type Props = {
  seasonId: string;
  seasonName: string;
  multiDayCheckInEnabled: boolean;
  dismissalTrackingEnabled: boolean;
};

const initial: SaveCheckInSettingsState | null = null;

export function CheckInSettingsForm({
  seasonId,
  seasonName,
  multiDayCheckInEnabled,
  dismissalTrackingEnabled,
}: Props) {
  const [state, action, pending] = useActionState(saveCheckInSettings.bind(null, seasonId), initial);

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
