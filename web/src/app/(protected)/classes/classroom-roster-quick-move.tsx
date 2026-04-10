"use client";

import { reassignRegistrationClassroomAction } from "@/app/(protected)/classes/actions";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function ClassroomRosterQuickMove({
  registrationId,
  currentClassroomId,
  seasonClassrooms,
}: {
  registrationId: string;
  currentClassroomId: string;
  seasonClassrooms: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [targetId, setTargetId] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const options = seasonClassrooms.filter((c) => c.id !== currentClassroomId);

  if (options.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        className="max-w-[200px] rounded-lg border border-foreground/15 bg-background px-2 py-1.5 text-xs"
        value={targetId}
        onChange={(e) => setTargetId(e.target.value)}
        aria-label="Move to class"
      >
        <option value="">Move to…</option>
        {options.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
        <option value="__unassign">— Unassigned —</option>
      </select>
      <button
        type="button"
        disabled={pending || !targetId}
        className="rounded-lg border border-foreground/20 bg-background px-2 py-1.5 text-xs font-medium hover:bg-foreground/[0.04] disabled:opacity-40"
        onClick={() => {
          if (!targetId) return;
          setMsg(null);
          startTransition(async () => {
            const dest = targetId === "__unassign" ? null : targetId;
            const r = await reassignRegistrationClassroomAction(registrationId, dest, null);
            setMsg(r.message);
            if (r.ok) {
              setTargetId("");
              router.refresh();
            }
          });
        }}
      >
        {pending ? "…" : "Move"}
      </button>
      {msg ? <span className="text-xs text-foreground/70">{msg}</span> : null}
    </div>
  );
}
