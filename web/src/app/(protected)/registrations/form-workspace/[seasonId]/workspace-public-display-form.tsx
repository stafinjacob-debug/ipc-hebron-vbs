"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  savePublicRegistrationSettings,
  type SavePublicSettingsState,
} from "../../../seasons/[seasonId]/public-settings/actions";
import type { PublicRegistrationLayout } from "@/generated/prisma";
import {
  PublicRegistrationGateFields,
  PublicRegistrationHelpEmailField,
  PublicRegistrationRequiredFields,
  PublicRegistrationSessionTimeField,
  PublicRegistrationWelcomeField,
  RegistrationBackgroundFields,
} from "../../../seasons/[seasonId]/public-settings/public-registration-display-blocks";

const initial: SavePublicSettingsState | null = null;

export function WorkspacePublicDisplayForm({
  seasonId,
  publicRegistrationOpen,
  registrationBackgroundImageUrl,
  registrationBackgroundVideoUrl,
  registrationBackgroundDimmingPercent,
  registrationBackgroundLayout,
  requireGuardianEmail,
  requireGuardianPhone,
  requireAllergiesNotes,
  welcomeMessage,
  sessionTimeDescription,
  helpContactEmail,
}: {
  seasonId: string;
  publicRegistrationOpen: boolean;
  registrationBackgroundImageUrl: string | null;
  registrationBackgroundVideoUrl: string | null;
  registrationBackgroundDimmingPercent: number;
  registrationBackgroundLayout: PublicRegistrationLayout;
  requireGuardianEmail: boolean;
  requireGuardianPhone: boolean;
  requireAllergiesNotes: boolean;
  welcomeMessage: string;
  sessionTimeDescription: string;
  helpContactEmail: string;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(
    savePublicRegistrationSettings.bind(null, seasonId),
    initial,
  );

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [router, state?.ok]);

  return (
    <form action={action} className="space-y-6">
      {state?.message ? (
        <div
          className={
            state.ok
              ? "rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200"
              : "rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-800 dark:text-red-200"
          }
        >
          {state.message}
        </div>
      ) : null}

      <PublicRegistrationGateFields publicRegistrationOpen={publicRegistrationOpen} />

      <RegistrationBackgroundFields
        registrationBackgroundImageUrl={registrationBackgroundImageUrl}
        registrationBackgroundVideoUrl={registrationBackgroundVideoUrl}
        registrationBackgroundDimmingPercent={registrationBackgroundDimmingPercent}
        registrationBackgroundLayout={registrationBackgroundLayout}
      />

      <PublicRegistrationRequiredFields
        requireGuardianEmail={requireGuardianEmail}
        requireGuardianPhone={requireGuardianPhone}
        requireAllergiesNotes={requireAllergiesNotes}
      />

      <PublicRegistrationWelcomeField welcomeMessage={welcomeMessage} />

      <PublicRegistrationSessionTimeField sessionTimeDescription={sessionTimeDescription} />

      <PublicRegistrationHelpEmailField helpContactEmail={helpContactEmail} />

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save public registration settings"}
      </button>
    </form>
  );
}
