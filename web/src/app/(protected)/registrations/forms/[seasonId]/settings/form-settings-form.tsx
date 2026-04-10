"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateRegistrationFormSettings } from "../../actions";

function toDatetimeLocalValue(d: Date | null | undefined): string {
  if (!d) return "";
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 16);
}

function fromDatetimeLocalValue(s: string): Date | null {
  const t = s.trim();
  if (!t) return null;
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function FormSettingsForm({
  seasonId,
  initial,
}: {
  seasonId: string;
  initial: {
    title: string;
    welcomeMessage: string | null;
    instructions: string | null;
    confirmationMessage: string | null;
    registrationOpensAt: Date | null;
    registrationClosesAt: Date | null;
    maxTotalRegistrations: number | null;
    waitlistEnabled: boolean;
    publicRegistrationOpen: boolean;
    minimumParticipantAgeYears: number | null;
    maximumParticipantAgeYears: number | null;
  };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <form
      className="space-y-8"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const title = String(fd.get("title") ?? "").trim();
        const welcomeMessage = String(fd.get("welcomeMessage") ?? "").trim() || null;
        const instructions = String(fd.get("instructions") ?? "").trim() || null;
        const confirmationMessage = String(fd.get("confirmationMessage") ?? "").trim() || null;
        const opens = fromDatetimeLocalValue(String(fd.get("registrationOpensAt") ?? ""));
        const closes = fromDatetimeLocalValue(String(fd.get("registrationClosesAt") ?? ""));
        const maxRaw = String(fd.get("maxTotalRegistrations") ?? "").trim();
        const maxTotalRegistrations = maxRaw ? Math.max(0, parseInt(maxRaw, 10) || 0) : null;
        const waitlistEnabled = fd.get("waitlistEnabled") === "on";
        const publicRegistrationOpen = fd.get("publicRegistrationOpen") === "on";
        const minAgeRaw = String(fd.get("minimumParticipantAgeYears") ?? "").trim();
        const minParsed = parseInt(minAgeRaw, 10);
        const minimumParticipantAgeYears =
          minAgeRaw && Number.isFinite(minParsed) && minParsed >= 1
            ? Math.min(99, minParsed)
            : null;
        const maxAgeRaw = String(fd.get("maximumParticipantAgeYears") ?? "").trim();
        const maxParsed = parseInt(maxAgeRaw, 10);
        const maximumParticipantAgeYears =
          maxAgeRaw && Number.isFinite(maxParsed) && maxParsed >= 1
            ? Math.min(99, maxParsed)
            : null;

        if (
          minimumParticipantAgeYears != null &&
          maximumParticipantAgeYears != null &&
          minimumParticipantAgeYears > maximumParticipantAgeYears
        ) {
          setMsg("Minimum age cannot be greater than maximum age.");
          return;
        }

        setMsg(null);
        startTransition(async () => {
          const r = await updateRegistrationFormSettings(seasonId, {
            title,
            welcomeMessage,
            instructions,
            confirmationMessage,
            registrationOpensAt: opens,
            registrationClosesAt: closes,
            maxTotalRegistrations,
            waitlistEnabled,
            publicRegistrationOpen,
            minimumParticipantAgeYears,
            maximumParticipantAgeYears,
          });
          setMsg(r.message);
          if (r.ok) router.refresh();
        });
      }}
    >
      <div className="space-y-4 rounded-xl border border-foreground/10 p-4">
        <h2 className="text-sm font-semibold">Form copy & messages</h2>
        <div>
          <label htmlFor="title" className="block text-xs font-medium text-foreground/70">
            Form title (public header)
          </label>
          <input
            id="title"
            name="title"
            required
            defaultValue={initial.title}
            className="mt-1 w-full rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="welcomeMessage" className="block text-xs font-medium text-foreground/70">
            Welcome text (shown under the title; can override season default)
          </label>
          <textarea
            id="welcomeMessage"
            name="welcomeMessage"
            rows={3}
            defaultValue={initial.welcomeMessage ?? ""}
            className="mt-1 w-full rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="instructions" className="block text-xs font-medium text-foreground/70">
            Instructions (optional, longer guidance)
          </label>
          <textarea
            id="instructions"
            name="instructions"
            rows={4}
            defaultValue={initial.instructions ?? ""}
            className="mt-1 w-full rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="confirmationMessage" className="block text-xs font-medium text-foreground/70">
            Confirmation message (after successful submit)
          </label>
          <textarea
            id="confirmationMessage"
            name="confirmationMessage"
            rows={3}
            defaultValue={initial.confirmationMessage ?? ""}
            className="mt-1 w-full rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="space-y-4 rounded-xl border border-foreground/10 p-4">
        <h2 className="text-sm font-semibold">Registration window & capacity</h2>
        <p className="text-sm text-foreground/70">
          Date/time uses your browser&apos;s local timezone. Leave open/close empty for no extra date limits
          (season &quot;Public signup&quot; toggle still applies).
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="registrationOpensAt" className="block text-xs font-medium text-foreground/70">
              Registration opens
            </label>
            <input
              id="registrationOpensAt"
              name="registrationOpensAt"
              type="datetime-local"
              defaultValue={toDatetimeLocalValue(initial.registrationOpensAt)}
              className="mt-1 w-full rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="registrationClosesAt" className="block text-xs font-medium text-foreground/70">
              Registration closes
            </label>
            <input
              id="registrationClosesAt"
              name="registrationClosesAt"
              type="datetime-local"
              defaultValue={toDatetimeLocalValue(initial.registrationClosesAt)}
              className="mt-1 w-full rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div>
          <label htmlFor="maxTotalRegistrations" className="block text-xs font-medium text-foreground/70">
            Max registrations (total children, all submissions)
          </label>
          <input
            id="maxTotalRegistrations"
            name="maxTotalRegistrations"
            type="number"
            min={0}
            placeholder="No limit"
            defaultValue={initial.maxTotalRegistrations ?? ""}
            className="mt-1 w-full max-w-xs rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="minimumParticipantAgeYears"
              className="block text-xs font-medium text-foreground/70"
            >
              Minimum child age (optional)
            </label>
            <input
              id="minimumParticipantAgeYears"
              name="minimumParticipantAgeYears"
              type="number"
              min={1}
              max={99}
              placeholder="No minimum"
              defaultValue={initial.minimumParticipantAgeYears ?? ""}
              className="mt-1 w-full rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label
              htmlFor="maximumParticipantAgeYears"
              className="block text-xs font-medium text-foreground/70"
            >
              Maximum child age (optional)
            </label>
            <input
              id="maximumParticipantAgeYears"
              name="maximumParticipantAgeYears"
              type="number"
              min={1}
              max={99}
              placeholder="No maximum"
              defaultValue={initial.maximumParticipantAgeYears ?? ""}
              className="mt-1 w-full rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>
        <p className="text-xs text-foreground/60">
          Whole years old on the first day of VBS (season start). Leave either field empty for no limit on that side.
        </p>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="waitlistEnabled"
            defaultChecked={initial.waitlistEnabled}
            className="size-4 rounded border-foreground/30"
          />
          Waitlist when full (otherwise block submit)
        </label>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            name="publicRegistrationOpen"
            defaultChecked={initial.publicRegistrationOpen}
            className="size-4 rounded border-foreground/30"
          />
          Public signup open for this season (master switch; same as season public settings)
        </label>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save settings"}
      </button>
      {msg ? <p className="text-sm text-foreground/80">{msg}</p> : null}
    </form>
  );
}
