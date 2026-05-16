"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { MessageMetaForm } from "@/app/(protected)/messages/message-meta-form";
import {
  bulkUpdateIncomingMessagesAction,
  type IncomingMessageActionState,
} from "@/app/(protected)/messages/actions";
import type { IncomingMessageStatus } from "@/generated/prisma";

type Row = {
  id: string;
  fromName: string | null;
  fromAddress: string;
  subject: string;
  bodyPreview: string | null;
  receivedAtLabel: string;
  status: IncomingMessageStatus;
  assignedToUserId: string | null;
  assignedToNameOrEmail: string | null;
  repliesCount: number;
};

const INITIAL: IncomingMessageActionState = { ok: false };

export function MessagesBulkTable({
  rows,
  assignees,
}: {
  rows: Row[];
  assignees: Array<{ id: string; name: string | null; email: string }>;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [state, action] = useActionState(bulkUpdateIncomingMessagesAction, INITIAL);
  const allOnPageSelected = useMemo(
    () => rows.length > 0 && rows.every((row) => selectedIds.includes(row.id)),
    [rows, selectedIds],
  );

  return (
    <div className="space-y-3">
      <form action={action} className="flex flex-wrap items-end gap-2 rounded-xl border border-foreground/10 bg-surface-elevated p-3">
        {selectedIds.map((id) => (
          <input key={id} type="hidden" name="messageIds" value={id} />
        ))}
        <div className="text-xs text-foreground/70">{selectedIds.length} selected</div>
        <div>
          <label htmlFor="bulk-status" className="block text-xs font-medium text-foreground/70">
            Bulk status
          </label>
          <select
            id="bulk-status"
            name="status"
            defaultValue="KEEP"
            className="mt-1 rounded-md border border-foreground/15 bg-background px-2 py-1.5 text-xs"
          >
            <option value="KEEP">No change</option>
            <option value="NEW">NEW</option>
            <option value="OPEN">OPEN</option>
            <option value="REPLIED">REPLIED</option>
            <option value="ARCHIVED">ARCHIVED</option>
          </select>
        </div>
        <div>
          <label htmlFor="bulk-assignee" className="block text-xs font-medium text-foreground/70">
            Bulk assignee
          </label>
          <select
            id="bulk-assignee"
            name="assignedToUserId"
            defaultValue="KEEP"
            className="mt-1 rounded-md border border-foreground/15 bg-background px-2 py-1.5 text-xs"
          >
            <option value="KEEP">No change</option>
            <option value="">Unassigned</option>
            {assignees.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name || u.email}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          disabled={selectedIds.length === 0}
        >
          Apply to selected
        </button>
        <button
          type="button"
          className="rounded-md border border-foreground/15 px-3 py-1.5 text-xs"
          onClick={() => setSelectedIds([])}
        >
          Clear
        </button>
        {state.error ? <p className="text-xs text-rose-700">{state.error}</p> : null}
        {state.ok && state.message ? <p className="text-xs text-emerald-700">{state.message}</p> : null}
      </form>

      <div className="overflow-hidden rounded-xl border border-foreground/10 bg-surface-elevated">
        <table className="w-full min-w-[980px] text-sm">
          <thead className="bg-foreground/[0.03] text-left text-xs uppercase tracking-wide text-foreground/60">
            <tr>
              <th className="px-3 py-3">
                <input
                  type="checkbox"
                  aria-label="Select all rows"
                  checked={allOnPageSelected}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedIds(rows.map((r) => r.id));
                    } else {
                      setSelectedIds([]);
                    }
                  }}
                />
              </th>
              <th className="px-4 py-3">From</th>
              <th className="px-4 py-3">Subject</th>
              <th className="px-4 py-3">Received</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Replies</th>
              <th className="px-4 py-3">Manage</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted">
                  No messages yet. Click Sync mailbox to pull inbox and sent mail from Microsoft 365.
                </td>
              </tr>
            ) : (
              rows.map((message) => {
                const checked = selectedIds.includes(message.id);
                return (
                  <tr key={message.id} className="border-t border-foreground/10 align-top">
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        aria-label={`Select ${message.subject}`}
                        checked={checked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedIds((prev) => [...prev, message.id]);
                          } else {
                            setSelectedIds((prev) => prev.filter((id) => id !== message.id));
                          }
                        }}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{message.fromName || message.fromAddress}</p>
                      <p className="text-xs text-muted">{message.fromAddress}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/messages/${message.id}`} className="font-medium text-brand hover:underline">
                        {message.subject}
                      </Link>
                      {message.bodyPreview ? <p className="mt-1 line-clamp-2 text-xs text-muted">{message.bodyPreview}</p> : null}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">{message.receivedAtLabel}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full border border-foreground/15 bg-background px-2 py-1 text-xs font-medium text-foreground/80">
                        {message.status}
                      </span>
                      {message.assignedToNameOrEmail ? (
                        <p className="mt-1 text-xs text-muted">Assigned to {message.assignedToNameOrEmail}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">{message.repliesCount}</td>
                    <td className="px-4 py-3">
                      <MessageMetaForm
                        incomingMessageId={message.id}
                        status={message.status}
                        assignedToUserId={message.assignedToUserId}
                        assignees={assignees}
                        compact
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
