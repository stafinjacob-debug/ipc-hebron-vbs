"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  savePublicRegistrationSettings,
  type SavePublicSettingsState,
} from "./actions";

type Props = {
  seasonId: string;
  publicRegistrationOpen: boolean;
  requireGuardianEmail: boolean;
  requireGuardianPhone: boolean;
  requireAllergiesNotes: boolean;
  welcomeMessage: string;
  registrationBackgroundImageUrl: string | null;
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

      <div className="rounded-xl border border-foreground/10 p-4">
        <h2 className="text-sm font-semibold text-foreground/90">Public signup page</h2>
        <p className="mt-1 text-sm text-foreground/60">
          Parents use{" "}
          <Link href="/register" className="font-medium text-foreground underline">
            /register
          </Link>{" "}
          when online registration is on for this season.
        </p>
        <label className="mt-4 flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            name="publicRegistrationOpen"
            defaultChecked={p.publicRegistrationOpen}
            className="mt-1"
          />
          <span>
            <span className="font-medium text-foreground">Accept public registrations</span>
            <span className="mt-0.5 block text-sm text-foreground/60">
              When off, this season is hidden from the public form.
            </span>
          </span>
        </label>
      </div>

      <div className="rounded-xl border border-foreground/10 p-4">
        <h2 className="text-sm font-semibold text-foreground/90">Registration page background</h2>
        <p className="mt-1 text-sm text-foreground/60">
          Shown full-screen behind the form when parents select this season on{" "}
          <code className="rounded bg-foreground/10 px-1">/register</code>. JPEG, PNG, WebP, or GIF,
          max 2.5 MB. Without Azure, files are stored under{" "}
          <code className="rounded bg-foreground/10 px-1">public/uploads</code> (not ideal for
          production — use Azure Blob).
        </p>
        {p.registrationBackgroundImageUrl ? (
          <div className="mt-4">
            <p className="text-xs text-foreground/50">Current image</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.registrationBackgroundImageUrl}
              alt=""
              className="mt-2 max-h-48 max-w-full rounded-md border border-foreground/15 object-contain"
            />
            <label className="mt-3 flex cursor-pointer items-start gap-3">
              <input type="checkbox" name="removeBackgroundImage" className="mt-1" />
              <span className="text-sm text-foreground/80">Remove background image</span>
            </label>
          </div>
        ) : null}
        <div className="mt-4">
          <label htmlFor="backgroundImage" className="text-sm font-medium text-foreground/80">
            {p.registrationBackgroundImageUrl ? "Replace image" : "Upload image"}
          </label>
          <input
            id="backgroundImage"
            name="backgroundImage"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="mt-2 block w-full text-sm text-foreground/80 file:mr-3 file:rounded-md file:border-0 file:bg-foreground/10 file:px-3 file:py-2 file:text-sm file:font-medium"
          />
        </div>
      </div>

      <div className="rounded-xl border border-foreground/10 p-4">
        <h2 className="text-sm font-semibold text-foreground/90">Required fields on public form</h2>
        <p className="mt-1 text-sm text-foreground/60">
          Parent and child first/last name and child date of birth are always required.
        </p>
        <ul className="mt-4 space-y-3">
          <li>
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                name="requireGuardianEmail"
                defaultChecked={p.requireGuardianEmail}
                className="mt-1"
              />
              <span className="text-sm">Require parent email</span>
            </label>
          </li>
          <li>
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                name="requireGuardianPhone"
                defaultChecked={p.requireGuardianPhone}
                className="mt-1"
              />
              <span className="text-sm">Require parent phone</span>
            </label>
          </li>
          <li>
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                name="requireAllergiesNotes"
                defaultChecked={p.requireAllergiesNotes}
                className="mt-1"
              />
              <span className="text-sm">Require allergies / medical notes (parents can enter “None”)</span>
            </label>
          </li>
        </ul>
      </div>

      <div className="rounded-xl border border-foreground/10 p-4">
        <label htmlFor="welcomeMessage" className="text-sm font-semibold text-foreground/90">
          Welcome message (optional)
        </label>
        <p className="mt-1 text-sm text-foreground/60">
          Shown at the top of the public form when this season is selected.
        </p>
        <textarea
          id="welcomeMessage"
          name="welcomeMessage"
          rows={5}
          defaultValue={p.welcomeMessage}
          className="mt-2 w-full rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm text-foreground"
          placeholder="e.g. Dates, drop-off time, what to bring…"
        />
      </div>

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
