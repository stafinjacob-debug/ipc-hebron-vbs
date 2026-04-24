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
  hidePublicRegistrationOpen = false,
}: {
  seasonId: string;
  /** When true, `publicRegistrationOpen` is omitted from this form (managed elsewhere, e.g. embed workspace). */
  hidePublicRegistrationOpen?: boolean;
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
    registrationNumberPrefix: string | null;
    registrationNumberSeqDigits: number;
    registrationNumberLastSeq: number;
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
        const publicRegistrationOpen = hidePublicRegistrationOpen
          ? initial.publicRegistrationOpen
          : fd.get("publicRegistrationOpen") === "on";
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

        const regPrefixRaw = String(fd.get("registrationNumberPrefix") ?? "").trim();
        const registrationNumberPrefix = regPrefixRaw.length > 0 ? regPrefixRaw : null;
        const seqDigRaw = String(fd.get("registrationNumberSeqDigits") ?? "").trim();
        const seqDigParsed = parseInt(seqDigRaw, 10);
        const registrationNumberSeqDigits =
          seqDigRaw && Number.isFinite(seqDigParsed) ? seqDigParsed : initial.registrationNumberSeqDigits;

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
            registrationNumberPrefix,
            registrationNumberSeqDigits,
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
        <h2 className="text-sm font-semibold">Registration number template</h2>
        <p className="text-sm text-foreground/70">
          When staff <strong>approves</strong> a child (or adds a confirmed office registration), the system assigns
          a ticket / badge number. Leave the prefix empty to keep the default{" "}
          <code className="rounded bg-foreground/[0.06] px-1 py-0.5 text-xs">VBS-{"{year}"}-{"{random}"}</code>{" "}
          style. With a prefix, numbers are sequential: e.g. prefix <code className="text-xs">IPCHVBS-</code> and three
          digits → <code className="text-xs">IPCHVBS-001</code>, <code className="text-xs">IPCHVBS-002</code>, …
        </p>
        <div>
          <label htmlFor="registrationNumberPrefix" className="block text-xs font-medium text-foreground/70">
            Number prefix (optional)
          </label>
          <input
            id="registrationNumberPrefix"
            name="registrationNumberPrefix"
            type="text"
            maxLength={32}
            placeholder="e.g. IPCHVBS-"
            defaultValue={initial.registrationNumberPrefix ?? ""}
            className="mt-1 w-full max-w-md rounded-md border border-foreground/15 bg-background px-3 py-2 font-mono text-sm"
          />
          <p className="mt-1 text-xs text-foreground/60">
            Letters, digits, <code className="text-[11px]">-</code> and <code className="text-[11px]">_</code>; must
            start with a letter or digit. Include a trailing hyphen if you want one.
          </p>
        </div>
        <div>
          <label htmlFor="registrationNumberSeqDigits" className="block text-xs font-medium text-foreground/70">
            Sequence digit width
          </label>
          <input
            id="registrationNumberSeqDigits"
            name="registrationNumberSeqDigits"
            type="number"
            min={2}
            max={8}
            defaultValue={initial.registrationNumberSeqDigits}
            className="mt-1 w-full max-w-[8rem] rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm tabular-nums"
          />
          <p className="mt-1 text-xs text-foreground/60">Between 2 and 8 (default 3 → 001, 002, …).</p>
        </div>
        <p className="text-xs text-foreground/60">
          Last issued sequence index:{" "}
          <span className="font-mono tabular-nums text-foreground/80">{initial.registrationNumberLastSeq}</span>
          {initial.registrationNumberPrefix?.trim() ? (
            <>
              {" — "}
              next sequential example:{" "}
              <span className="font-mono tabular-nums text-foreground/80">
                {initial.registrationNumberPrefix.trim() +
                  String(initial.registrationNumberLastSeq + 1).padStart(
                    Math.min(8, Math.max(2, initial.registrationNumberSeqDigits)),
                    "0",
                  )}
              </span>
            </>
          ) : (
            <> — save a prefix to use sequential numbers instead of the default format.</>
          )}
        </p>
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
        {hidePublicRegistrationOpen ? null : (
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              name="publicRegistrationOpen"
              defaultChecked={initial.publicRegistrationOpen}
              className="size-4 rounded border-foreground/30"
            />
            Public signup open for this season (master switch; same as season public settings)
          </label>
        )}
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
