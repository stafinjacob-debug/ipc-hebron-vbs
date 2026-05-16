"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { sendComposedEmailAction, type IncomingMessageActionState } from "@/app/(protected)/messages/actions";

const INITIAL: IncomingMessageActionState = { ok: false };

function SendButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className="inline-flex items-center rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
      disabled={pending}
    >
      {pending ? "Sending…" : "Send email"}
    </button>
  );
}

export function ComposeEmailForm() {
  const [state, action] = useActionState(sendComposedEmailAction, INITIAL);

  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="toAddresses" className="block text-xs font-medium text-foreground/70">
          To
        </label>
        <textarea
          id="toAddresses"
          name="toAddresses"
          required
          rows={2}
          placeholder="one@example.com, other@example.com"
          className="mt-1 w-full rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm outline-none ring-brand/40 placeholder:text-foreground/45 focus:ring-2"
        />
        <p className="mt-1 text-xs text-muted">Separate multiple addresses with commas, semicolons, or new lines.</p>
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
        <SendButton />
        {state.error ? <p className="text-xs text-rose-700">{state.error}</p> : null}
        {state.ok && state.message ? <p className="text-xs text-emerald-700">{state.message}</p> : null}
      </div>
    </form>
  );
}
