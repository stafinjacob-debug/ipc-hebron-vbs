"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  previewComposeRegistrantAudienceAction,
  sendComposedEmailAction,
  type IncomingMessageActionState,
} from "@/app/(protected)/messages/actions";
import { COMPOSE_REGISTRANT_AUDIENCE_OPTIONS } from "@/lib/compose-registrant-audience-options";

const INITIAL: IncomingMessageActionState = { ok: false };

type SeasonOption = { id: string; name: string; year: number };

function SendButton({ registrantMode }: { registrantMode: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className="inline-flex items-center rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
      disabled={pending}
    >
      {pending ? "Sending…" : registrantMode ? "Send to group" : "Send email"}
    </button>
  );
}

export function ComposeEmailForm({ seasons }: { seasons: SeasonOption[] }) {
  const [state, action] = useActionState(sendComposedEmailAction, INITIAL);
  const [recipientMode, setRecipientMode] = useState<"manual" | "registrants">("manual");
  const [seasonId, setSeasonId] = useState(seasons[0]?.id ?? "");
  const [audience, setAudience] = useState(COMPOSE_REGISTRANT_AUDIENCE_OPTIONS[0]?.value ?? "all_active");
  const [preview, setPreview] = useState<{
    recipientCount: number;
    matchingRegistrations: number;
    skippedNoEmail: number;
  } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const selectedAudience = COMPOSE_REGISTRANT_AUDIENCE_OPTIONS.find((o) => o.value === audience);

  useEffect(() => {
    if (recipientMode !== "registrants" || !seasonId || !audience) {
      setPreview(null);
      setPreviewError(null);
      return;
    }

    let cancelled = false;
    setPreviewLoading(true);
    setPreviewError(null);

    previewComposeRegistrantAudienceAction(seasonId, audience).then((r) => {
      if (cancelled) return;
      setPreviewLoading(false);
      if (r.ok) {
        setPreview({
          recipientCount: r.recipientCount,
          matchingRegistrations: r.matchingRegistrations,
          skippedNoEmail: r.skippedNoEmail,
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
  }, [recipientMode, seasonId, audience]);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="recipientMode" value={recipientMode} />

      <fieldset className="space-y-3">
        <legend className="text-xs font-medium text-foreground/70">Recipients</legend>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="inline-flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name="recipientModeUi"
              checked={recipientMode === "manual"}
              onChange={() => setRecipientMode("manual")}
            />
            Manual addresses
          </label>
          <label className="inline-flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name="recipientModeUi"
              checked={recipientMode === "registrants"}
              onChange={() => setRecipientMode("registrants")}
            />
            Registrants by group
          </label>
        </div>
      </fieldset>

      {recipientMode === "registrants" ? (
        <div className="space-y-4 rounded-lg border border-foreground/10 bg-foreground/[0.02] p-4">
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
              onChange={(e) => setAudience(e.target.value as typeof audience)}
              className="mt-1 w-full rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm outline-none ring-brand/40 focus:ring-2"
            >
              {COMPOSE_REGISTRANT_AUDIENCE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {selectedAudience?.hint ? (
              <p className="mt-1 text-xs text-muted">{selectedAudience.hint}</p>
            ) : null}
          </div>

          <div className="rounded-md border border-foreground/10 bg-background px-3 py-2 text-xs text-muted">
            {previewLoading ? (
              <span>Counting recipients…</span>
            ) : previewError ? (
              <span className="text-rose-700">{previewError}</span>
            ) : preview ? (
              <span>
                <strong className="text-foreground">{preview.recipientCount}</strong> guardian email
                {preview.recipientCount === 1 ? "" : " addresses"} will receive this message (
                {preview.matchingRegistrations} matching registration
                {preview.matchingRegistrations === 1 ? "" : "s"}
                {preview.skippedNoEmail > 0
                  ? `; ${preview.skippedNoEmail} skipped with no valid email`
                  : ""}
                ). Each address gets its own email — recipients are not visible to each other.
              </span>
            ) : (
              <span>Choose a season and group to see how many families will be emailed.</span>
            )}
          </div>
        </div>
      ) : (
        <div>
          <label htmlFor="toAddresses" className="block text-xs font-medium text-foreground/70">
            To
          </label>
          <textarea
            id="toAddresses"
            name="toAddresses"
            rows={2}
            placeholder="one@example.com, other@example.com"
            className="mt-1 w-full rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm outline-none ring-brand/40 placeholder:text-foreground/45 focus:ring-2"
          />
          <p className="mt-1 text-xs text-muted">
            Separate multiple addresses with commas, semicolons, or new lines (max 25). For larger sends,
            use registrant groups above.
          </p>
        </div>
      )}

      <div>
        <label htmlFor="subject" className="block text-xs font-medium text-foreground/70">
          Subject
        </label>
        <input
          id="subject"
          name="subject"
          type="text"
          required
          className="mt-1 w-full rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm outline-none ring-brand/40 focus:ring-2"
        />
      </div>
      <div>
        <label htmlFor="body" className="block text-xs font-medium text-foreground/70">
          Message
        </label>
        <textarea
          id="body"
          name="body"
          required
          rows={12}
          placeholder="Write your message…"
          className="mt-1 w-full rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm outline-none ring-brand/40 placeholder:text-foreground/45 focus:ring-2"
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <SendButton registrantMode={recipientMode === "registrants"} />
        {state.error ? <p className="text-xs text-rose-700">{state.error}</p> : null}
        {state.ok && state.message ? <p className="text-xs text-emerald-700">{state.message}</p> : null}
      </div>
    </form>
  );
}
