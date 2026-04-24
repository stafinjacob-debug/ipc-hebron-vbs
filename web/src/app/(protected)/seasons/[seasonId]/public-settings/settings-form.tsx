"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  savePublicRegistrationSettings,
  type SavePublicSettingsState,
} from "./actions";
import { PublicRegistrationGateFields, RegistrationBackgroundFields } from "./public-registration-display-blocks";

type Props = {
  seasonId: string;
  publicRegistrationOpen: boolean;
  registrationBackgroundImageUrl: string | null;
  registrationBackgroundDimmingPercent: number;
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

      <RegistrationBackgroundFields
        registrationBackgroundImageUrl={p.registrationBackgroundImageUrl}
        registrationBackgroundDimmingPercent={p.registrationBackgroundDimmingPercent}
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
