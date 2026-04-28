"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { syncIncomingMessagesAction, type IncomingMessageActionState } from "@/app/(protected)/messages/actions";

const INITIAL: IncomingMessageActionState = { ok: false };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className="inline-flex items-center rounded-md border border-foreground/15 bg-background px-3 py-1.5 text-sm font-medium text-foreground hover:bg-foreground/[0.04] disabled:cursor-not-allowed disabled:opacity-60"
      disabled={pending}
    >
      {pending ? "Syncing..." : "Sync inbox"}
    </button>
  );
}

export function MessageSyncButton() {
  const [state, action] = useActionState(syncIncomingMessagesAction, INITIAL);
  return (
    <form action={action} className="flex items-center gap-3">
      <SubmitButton />
      {state.error ? <p className="text-xs text-rose-700">{state.error}</p> : null}
      {state.ok && state.message ? <p className="text-xs text-emerald-700">{state.message}</p> : null}
    </form>
  );
}
