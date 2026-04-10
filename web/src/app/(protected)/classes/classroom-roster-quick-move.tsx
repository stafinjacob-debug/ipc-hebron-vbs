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
        className="max-w-[220px] rounded-lg border border-foreground/15 bg-background px-2 py-1.5 text-xs"
        value={targetId}
        disabled={pending}
        onChange={(e) => {
          const v = e.target.value;
          if (!v) return;
          setMsg(null);
          setTargetId(v);
          startTransition(async () => {
            const dest = v === "__unassign" ? null : v;
            const r = await reassignRegistrationClassroomAction(registrationId, dest, null);
            setMsg(r.message);
            if (r.ok) {
              setTargetId("");
              router.refresh();
            }
          });
        }}
        aria-label="Move to class or unassign"
      >
        <option value="">Move or unassign…</option>
        {options.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
        <option value="__unassign">— Unassigned —</option>
      </select>
      {pending ? <span className="text-xs text-muted">Updating…</span> : null}
      {msg ? <span className="text-xs text-foreground/70">{msg}</span> : null}
    </div>
  );
}
