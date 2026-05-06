"use client";

import type { IncomingMessageStatus } from "@/generated/prisma";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  updateIncomingMessageMetaAction,
  type IncomingMessageActionState,
} from "@/app/(protected)/messages/actions";

const INITIAL: IncomingMessageActionState = { ok: false };

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className="inline-flex items-center rounded-md border border-foreground/15 px-2.5 py-1.5 text-xs font-medium hover:bg-foreground/[0.04] disabled:opacity-60"
      disabled={pending}
    >
      {pending ? "Saving..." : "Save"}
    </button>
  );
}

export function MessageMetaForm({
  incomingMessageId,
  status,
  assignedToUserId,
  assignees,
  compact = false,
}: {
  incomingMessageId: string;
  status: IncomingMessageStatus;
  assignedToUserId: string | null;
  assignees: Array<{ id: string; name: string | null; email: string }>;
  compact?: boolean;
}) {
  const [state, action] = useActionState(updateIncomingMessageMetaAction, INITIAL);
  return (
    <form action={action} className={compact ? "flex flex-wrap items-center gap-2" : "space-y-2"}>
      <input type="hidden" name="incomingMessageId" value={incomingMessageId} />

      <select
        name="status"
        defaultValue={status}
        className="rounded-md border border-foreground/15 bg-background px-2 py-1.5 text-xs"
      >
        <option value="NEW">NEW</option>
        <option value="OPEN">OPEN</option>
        <option value="REPLIED">REPLIED</option>
        <option value="ARCHIVED">ARCHIVED</option>
      </select>

      <select
        name="assignedToUserId"
        defaultValue={assignedToUserId ?? ""}
        className="rounded-md border border-foreground/15 bg-background px-2 py-1.5 text-xs"
      >
        <option value="">Unassigned</option>
        {assignees.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name || u.email}
          </option>
        ))}
      </select>

      <SaveButton />
      {state.error ? <p className="text-xs text-rose-700">{state.error}</p> : null}
      {state.ok && state.message ? <p className="text-xs text-emerald-700">{state.message}</p> : null}
    </form>
  );
}
