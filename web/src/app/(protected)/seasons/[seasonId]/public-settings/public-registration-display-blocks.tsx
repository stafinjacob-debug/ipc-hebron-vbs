import Link from "next/link";

/** “Accept public responses” gate — same field as season `publicRegistrationOpen`. */
export function PublicRegistrationGateFields({ publicRegistrationOpen }: { publicRegistrationOpen: boolean }) {
  return (
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
        <input type="checkbox" name="publicRegistrationOpen" defaultChecked={publicRegistrationOpen} className="mt-1" />
        <span>
          <span className="font-medium text-foreground">Accept public responses</span>
          <span className="mt-0.5 block text-sm text-foreground/60">
            When off, this season is hidden from the public form.
          </span>
        </span>
      </label>
    </div>
  );
}

/** Registration page background — same markup as the full public settings page. */
export function RegistrationBackgroundFields({
  registrationBackgroundImageUrl,
  registrationBackgroundDimmingPercent,
}: {
  registrationBackgroundImageUrl: string | null;
  registrationBackgroundDimmingPercent: number;
}) {
  return (
    <div className="rounded-xl border border-foreground/10 p-4">
      <h2 className="text-sm font-semibold text-foreground/90">Registration page background</h2>
      <p className="mt-1 text-sm text-foreground/60">
        Shown full-screen behind the form when parents select this season on{" "}
        <code className="rounded bg-foreground/10 px-1">/register</code>. JPEG, PNG, WebP, or GIF,
        max 2.5 MB. Without Azure, files are stored under{" "}
        <code className="rounded bg-foreground/10 px-1">public/uploads</code> (not ideal for
        production — use Azure Blob).
      </p>
      {registrationBackgroundImageUrl ? (
        <div className="mt-4">
          <p className="text-xs text-foreground/50">Current image</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={registrationBackgroundImageUrl}
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
          {registrationBackgroundImageUrl ? "Replace image" : "Upload image"}
        </label>
        <input
          id="backgroundImage"
          name="backgroundImage"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="mt-2 block w-full text-sm text-foreground/80 file:mr-3 file:rounded-md file:border-0 file:bg-foreground/10 file:px-3 file:py-2 file:text-sm file:font-medium"
        />
      </div>
      <div className="mt-6">
        <label htmlFor="registrationBackgroundDimmingPercent" className="text-sm font-medium text-foreground/80">
          Background dimming (0–100%)
        </label>
        <p className="mt-1 text-xs text-foreground/60">
          Dark overlay on top of the photo on <code className="rounded bg-foreground/10 px-1">/register</code>.{" "}
          Try roughly 35–55 if you want the picture to read clearly; raise it if the form text is hard to read.
        </p>
        <input
          id="registrationBackgroundDimmingPercent"
          name="registrationBackgroundDimmingPercent"
          type="range"
          min={0}
          max={100}
          step={1}
          defaultValue={registrationBackgroundDimmingPercent}
          className="mt-3 block w-full max-w-md accent-foreground"
        />
        <div className="mt-1 flex max-w-md justify-between text-xs text-foreground/50">
          <span>Bright (0)</span>
          <span>Dark (100)</span>
        </div>
      </div>
    </div>
  );
}

export function PublicRegistrationRequiredFields({
  requireGuardianEmail,
  requireGuardianPhone,
  requireAllergiesNotes,
}: {
  requireGuardianEmail: boolean;
  requireGuardianPhone: boolean;
  requireAllergiesNotes: boolean;
}) {
  return (
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
              defaultChecked={requireGuardianEmail}
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
              defaultChecked={requireGuardianPhone}
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
              defaultChecked={requireAllergiesNotes}
              className="mt-1"
            />
            <span className="text-sm">Require allergies / medical notes (parents can enter “None”)</span>
          </label>
        </li>
      </ul>
    </div>
  );
}

/** Public `/register` welcome banner (not the staff registration form welcome). */
export function PublicRegistrationWelcomeField({ welcomeMessage }: { welcomeMessage: string }) {
  return (
    <div className="rounded-xl border border-foreground/10 p-4">
      <label htmlFor="publicWelcomeMessage" className="text-sm font-semibold text-foreground/90">
        Welcome message (optional)
      </label>
      <p className="mt-1 text-sm text-foreground/60">
        Shown at the top of the public form when this season is selected.
      </p>
      <textarea
        id="publicWelcomeMessage"
        name="welcomeMessage"
        rows={5}
        defaultValue={welcomeMessage}
        className="mt-2 w-full rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm text-foreground"
        placeholder="e.g. Dates, drop-off time, what to bring…"
      />
    </div>
  );
}
