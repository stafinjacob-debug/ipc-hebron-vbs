"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { PublicRegistrationLayout } from "@/generated/prisma";
import {
  savePublicRegistrationSettings,
  type SavePublicSettingsState,
} from "./actions";
import {
  PublicRegistrationGateFields,
  PublicRegistrationSessionTimeField,
  RegistrationBackgroundFields,
} from "./public-registration-display-blocks";

type Props = {
  seasonId: string;
  publicRegistrationOpen: boolean;
  seasonStartDate: Date;
  seasonEndDate: Date;
  sessionTimeDescription: string | null;
  registrationBackgroundImageUrl: string | null;
  registrationBackgroundVideoUrl: string | null;
  registrationBackgroundDimmingPercent: number;
  registrationBackgroundLayout: PublicRegistrationLayout;
};

const initial: SavePublicSettingsState | null = null;

export function PublicRegistrationSettingsForm(p: Props) {
  const [state, action, pending] = useActionState(
    savePublicRegistrationSettings.bind(null, p.seasonId),
    initial,
  );

  return (
    <form action={action} className="max-w-2xl space-y-8">
      {state?.message && (
        <div
          className={
            state.ok
              ? "rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200"
              : "rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-800 dark:text-red-200"
          }
        >
          {state.message}
        </div>
      )}

      <PublicRegistrationGateFields publicRegistrationOpen={p.publicRegistrationOpen} />

      <div className="rounded-xl border border-foreground/10 p-4">
        <h2 className="text-sm font-semibold text-foreground/90">Season dates</h2>
        <p className="mt-1 text-sm text-foreground/60">
          These dates appear on registration pages and are used for age-gate checks.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="seasonStartDate" className="block text-xs font-medium text-foreground/70">
              Start date
            </label>
            <input
              id="seasonStartDate"
              name="seasonStartDate"
              type="date"
              defaultValue={p.seasonStartDate.toISOString().slice(0, 10)}
              className="mt-1 w-full rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="seasonEndDate" className="block text-xs font-medium text-foreground/70">
              End date
            </label>
            <input
              id="seasonEndDate"
              name="seasonEndDate"
              type="date"
              defaultValue={p.seasonEndDate.toISOString().slice(0, 10)}
              className="mt-1 w-full rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>
        <PublicRegistrationSessionTimeField
          sessionTimeDescription={p.sessionTimeDescription}
          embedded
        />
      </div>

      <RegistrationBackgroundFields
        registrationBackgroundImageUrl={p.registrationBackgroundImageUrl}
        registrationBackgroundVideoUrl={p.registrationBackgroundVideoUrl}
        registrationBackgroundDimmingPercent={p.registrationBackgroundDimmingPercent}
        registrationBackgroundLayout={p.registrationBackgroundLayout}
      />

      <p className="rounded-lg border border-foreground/10 bg-foreground/[0.03] px-4 py-3 text-sm text-foreground/70">
        Required fields on the public form and the public welcome banner are managed in{" "}
        <Link href="/registrations/forms" className="font-medium text-brand underline">
          Form builder
        </Link>{" "}
        — expand your season, then open the <strong>Settings</strong> tab.
      </p>

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save settings"}
        </button>
        <Link
          href="/seasons"
          className="inline-flex items-center rounded-md border border-foreground/15 px-4 py-2 text-sm hover:bg-foreground/5"
        >
          Back to seasons
        </Link>
      </div>
    </form>
  );
}
