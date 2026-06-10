"use client";

import { useActionState, useEffect, useState, type FormEvent } from "react";
import { useFormStatus } from "react-dom";
import {
  previewCheckInPacketAudienceAction,
  sendCheckInPacketAction,
  type CheckInPacketActionState,
} from "@/app/(protected)/messages/check-in-packet-actions";
import { COMPOSE_REGISTRANT_AUDIENCE_OPTIONS } from "@/lib/compose-registrant-audience-options";

const INITIAL: CheckInPacketActionState = { ok: false };

type SeasonOption = { id: string; name: string; year: number };

function SendButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className="inline-flex items-center rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
      disabled={pending}
    >
      {pending ? "Sending…" : "Send check-in packets"}
    </button>
  );
}

export function CheckInPacketForm({ seasons }: { seasons: SeasonOption[] }) {
  const [state, action] = useActionState(sendCheckInPacketAction, INITIAL);
  const [seasonId, setSeasonId] = useState(seasons[0]?.id ?? "");
  const [audience, setAudience] = useState("confirmed");
  const [preview, setPreview] = useState<{
    recipientCount: number;
    matchingRegistrations: number;
    skippedNoEmail: number;
    skippedNoCheckInIdentity: number;
    eligibleChildren: number;
  } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const selectedAudience = COMPOSE_REGISTRANT_AUDIENCE_OPTIONS.find((o) => o.value === audience);

  useEffect(() => {
    if (!seasonId || !audience) {
      setPreview(null);
      setPreviewError(null);
      return;
    }

    let cancelled = false;
    setPreviewLoading(true);
    setPreviewError(null);

    previewCheckInPacketAudienceAction(seasonId, audience).then((r) => {
      if (cancelled) return;
      setPreviewLoading(false);
      if (r.ok) {
        setPreview({
          recipientCount: r.recipientCount,
          matchingRegistrations: r.matchingRegistrations,
          skippedNoEmail: r.skippedNoEmail,
          skippedNoCheckInIdentity: r.skippedNoCheckInIdentity,
          eligibleChildren: r.eligibleChildren,
        });
        setPreviewError(null);
      } else {
        setPreview(null);
        setPreviewError(r.error);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [seasonId, audience]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    if (preview && preview.recipientCount > 0) {
      const ok = window.confirm(
        `Send check-in packets to ${preview.recipientCount} famil${preview.recipientCount === 1 ? "y" : "ies"} (${preview.eligibleChildren} child check-in card${preview.eligibleChildren === 1 ? "" : "s"})?`,
      );
      if (!ok) {
        event.preventDefault();
      }
    }
  };

  return (
    <form action={action} encType="multipart/form-data" className="space-y-4" onSubmit={handleSubmit}>
      <div className="rounded-lg border border-sky-500/25 bg-sky-500/5 px-4 py-3 text-sm text-sky-950 dark:text-sky-100">
        Each family receives one email with a personalized check-in card (QR code, registration number, and class) for
        every eligible child, plus the same attachment on every send. Only registrations with a registration number and
        check-in token are included.
      </div>

      <div>
        <label htmlFor="seasonId" className="block text-xs font-medium text-foreground/70">
          Season
        </label>
        <select
          id="seasonId"
          name="seasonId"
          required
          value={seasonId}
          onChange={(e) => setSeasonId(e.target.value)}
          className="mt-1 w-full rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm outline-none ring-brand/40 focus:ring-2"
        >
          {seasons.length === 0 ? (
            <option value="">No seasons found</option>
          ) : (
            seasons.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.year})
              </option>
            ))
          )}
        </select>
      </div>

      <div>
        <label htmlFor="registrantAudience" className="block text-xs font-medium text-foreground/70">
          Send to
        </label>
        <select
          id="registrantAudience"
          name="registrantAudience"
          required
          value={audience}
          onChange={(e) => setAudience(e.target.value)}
          className="mt-1 w-full rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm outline-none ring-brand/40 focus:ring-2"
        >
          {COMPOSE_REGISTRANT_AUDIENCE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {selectedAudience?.hint ? <p className="mt-1 text-xs text-muted">{selectedAudience.hint}</p> : null}
      </div>

      <div className="rounded-md border border-foreground/10 bg-background px-3 py-2 text-xs text-muted">
        {previewLoading ? (
          <span>Counting families with check-in cards…</span>
        ) : previewError ? (
          <span className="text-rose-700">{previewError}</span>
        ) : preview ? (
          <span>
            <strong className="text-foreground">{preview.recipientCount}</strong> famil
            {preview.recipientCount === 1 ? "y" : "ies"} will receive packets with{" "}
            <strong className="text-foreground">{preview.eligibleChildren}</strong> child check-in card
            {preview.eligibleChildren === 1 ? "" : "s"} (
            {preview.matchingRegistrations} matching registration
            {preview.matchingRegistrations === 1 ? "" : "s"}
            {preview.skippedNoEmail > 0 ? `; ${preview.skippedNoEmail} skipped with no valid email` : ""}
            {preview.skippedNoCheckInIdentity > 0
              ? `; ${preview.skippedNoCheckInIdentity} skipped without registration # / QR token`
              : ""}
            ). Each address gets its own email.
          </span>
        ) : (
          <span>Choose a season and group to preview how many check-in packets will be sent.</span>
        )}
      </div>

      <div>
        <label htmlFor="subject" className="block text-xs font-medium text-foreground/70">
          Subject
        </label>
        <input
          id="subject"
          name="subject"
          type="text"
          required
          defaultValue="Your VBS check-in packet"
          className="mt-1 w-full rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm outline-none ring-brand/40 focus:ring-2"
        />
      </div>

      <div>
        <label htmlFor="body" className="block text-xs font-medium text-foreground/70">
          Message <span className="font-normal text-muted">(optional intro before check-in cards)</span>
        </label>
        <textarea
          id="body"
          name="body"
          rows={8}
          placeholder="Add parking directions, drop-off times, or other notes for families…"
          className="mt-1 w-full rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm outline-none ring-brand/40 placeholder:text-foreground/45 focus:ring-2"
        />
      </div>

      <div>
        <label htmlFor="attachment" className="block text-xs font-medium text-foreground/70">
          Attachment <span className="font-normal text-muted">(optional, same file for every family)</span>
        </label>
        <input
          id="attachment"
          name="attachment"
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,application/pdf,image/png,image/jpeg,image/webp"
          className="mt-1 block w-full text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-brand/10 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand hover:file:bg-brand/15"
        />
        <p className="mt-1 text-xs text-muted">PDF, PNG, JPEG, WebP, DOC, or DOCX — max 3 MB.</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SendButton />
        {state.error ? <p className="text-xs text-rose-700">{state.error}</p> : null}
        {state.ok && state.message ? <p className="text-xs text-emerald-700">{state.message}</p> : null}
      </div>
    </form>
  );
}
