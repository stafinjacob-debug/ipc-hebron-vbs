"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { replyToIncomingMessageAction, type IncomingMessageActionState } from "@/app/(protected)/messages/actions";

const INITIAL: IncomingMessageActionState = { ok: false };

function SendButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className="inline-flex items-center rounded-md bg-brand px-3 py-2 text-sm font-semibold text-white hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
      disabled={pending}
    >
      {pending ? "Sending..." : "Send reply"}
    </button>
  );
}

export function ReplyForm({ incomingMessageId }: { incomingMessageId: string }) {
  const [state, action] = useActionState(replyToIncomingMessageAction, INITIAL);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="incomingMessageId" value={incomingMessageId} />
      <textarea
        name="replyBody"
        required
        rows={6}
        placeholder="Type your reply..."
        className="w-full rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm outline-none ring-brand/40 placeholder:text-foreground/45 focus:ring-2"
      />
      <div className="flex items-center gap-3">
        <SendButton />
        {state.error ? <p className="text-xs text-rose-700">{state.error}</p> : null}
        {state.ok && state.message ? <p className="text-xs text-emerald-700">{state.message}</p> : null}
      </div>
    </form>
  );
}
