import Link from "next/link";
import type { PublicRegistrationLayout } from "@/generated/prisma";

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

const LAYOUT_OPTIONS: { value: PublicRegistrationLayout; label: string; hint: string }[] = [
  {
    value: "OVERLAY",
    label: "Centered over background",
    hint: "Form stays in a column on top of a full-screen photo or video (default).",
  },
  {
    value: "SPLIT_FORM_LEFT",
    label: "Form on the left",
    hint: "On large screens: form in the left column, media in the right. Stacked on phones.",
  },
  {
    value: "SPLIT_FORM_RIGHT",
    label: "Form on the right",
    hint: "On large screens: media on the left, form on the right. Stacked on phones.",
  },
];

/** Registration page background — same markup as the full public settings page. */
export function RegistrationBackgroundFields({
  registrationBackgroundImageUrl,
  registrationBackgroundVideoUrl,
  registrationBackgroundDimmingPercent,
  registrationBackgroundLayout,
}: {
  registrationBackgroundImageUrl: string | null;
  registrationBackgroundVideoUrl: string | null;
  registrationBackgroundDimmingPercent: number;
  registrationBackgroundLayout: PublicRegistrationLayout;
}) {
  return (
    <div className="rounded-xl border border-foreground/10 p-4">
      <h2 className="text-sm font-semibold text-foreground/90">Registration page background</h2>
      <p className="mt-1 text-sm text-foreground/60">
        Shown on <code className="rounded bg-foreground/10 px-1">/register</code> when parents pick
        this season. Image: JPEG, PNG, WebP, or GIF, max 2.5 MB. Optional video: MP4 or WebM, max
        10 MB — if both are set, the <strong>video</strong> is used. Without Azure, files go under{" "}
        <code className="rounded bg-foreground/10 px-1">public/uploads</code>.
      </p>

      <fieldset className="mt-6 space-y-3">
        <legend className="text-sm font-medium text-foreground/80">Layout on /register</legend>
        {LAYOUT_OPTIONS.map((opt) => (
          <label key={opt.value} className="flex cursor-pointer items-start gap-3 rounded-lg border border-transparent px-1 py-1 hover:border-foreground/10">
            <input
              type="radio"
              name="registrationBackgroundLayout"
              value={opt.value}
              defaultChecked={registrationBackgroundLayout === opt.value}
              className="mt-1"
            />
            <span>
              <span className="block text-sm font-medium text-foreground">{opt.label}</span>
              <span className="mt-0.5 block text-xs text-foreground/55">{opt.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {registrationBackgroundVideoUrl ? (
        <div className="mt-6 border-t border-foreground/10 pt-6">
          <p className="text-xs text-foreground/50">Current background video</p>
          <video
            src={registrationBackgroundVideoUrl}
            className="mt-2 max-h-48 max-w-full rounded-md border border-foreground/15"
            controls
            muted
            playsInline
          />
          <label className="mt-3 flex cursor-pointer items-start gap-3">
            <input type="checkbox" name="removeBackgroundVideo" className="mt-1" />
            <span className="text-sm text-foreground/80">Remove background video</span>
          </label>
        </div>
      ) : null}
      <div className="mt-4">
        <label htmlFor="backgroundVideo" className="text-sm font-medium text-foreground/80">
          {registrationBackgroundVideoUrl ? "Replace video" : "Upload background video (optional)"}
        </label>
        <input
          id="backgroundVideo"
          name="backgroundVideo"
          type="file"
          accept="video/mp4,video/webm"
          className="mt-2 block w-full text-sm text-foreground/80 file:mr-3 file:rounded-md file:border-0 file:bg-foreground/10 file:px-3 file:py-2 file:text-sm file:font-medium"
        />
      </div>

      {registrationBackgroundImageUrl ? (
        <div className="mt-6 border-t border-foreground/10 pt-6">
          <p className="text-xs text-foreground/50">Current image (fallback if no video)</p>
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
          {registrationBackgroundImageUrl ? "Replace image" : "Upload image (optional)"}
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

/** Optional daily hours — login landing card + `/register` wizard header (PublicRegistrationSettings). */
export function PublicRegistrationSessionTimeField({
  sessionTimeDescription,
  embedded = false,
}: {
  sessionTimeDescription: string | null;
  /** When true, omit the outer card (e.g. nested inside “Season dates”). */
  embedded?: boolean;
}) {
  const body = (
    <>
      <label htmlFor="sessionTimeDescription" className="text-sm font-semibold text-foreground/90">
        Session / daily times (optional)
      </label>
      <p className="mt-1 text-sm text-foreground/60">
        Shown on the <strong className="font-medium text-foreground/75">public login card</strong> (when programs are
        open) and <strong className="font-medium text-foreground/75">under the dates</strong> on{" "}
        <code className="rounded bg-foreground/10 px-1 text-xs">/register</code> for this season.
      </p>
      <textarea
        id="sessionTimeDescription"
        name="sessionTimeDescription"
        rows={2}
        defaultValue={sessionTimeDescription ?? ""}
        placeholder="e.g. 9:00 AM – 12:15 PM daily (doors open 8:45 AM)"
        className="mt-2 w-full rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm text-foreground"
      />
    </>
  );
  if (embedded) {
    return <div className="mt-4">{body}</div>;
  }
  return <div className="rounded-xl border border-foreground/10 p-4">{body}</div>;
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
