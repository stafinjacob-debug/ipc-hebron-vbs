"use client";

import { reassignRegistrationClassroomAction } from "@/app/(protected)/classes/actions";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function ClassroomAddUnassigned({
  targetClassroomId,
  candidates,
}: {
  targetClassroomId: string;
  candidates: Array<{
    registrationId: string;
    childFirstName: string;
    childLastName: string;
    status: string;
    registrationNumber: string | null;
    /** Extra context from configured form fields (and age), shown after the main label. */
    details?: string;
  }>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  if (candidates.length === 0) {
    return (
      <p className="mt-2 text-sm text-muted">
        No students are currently unassigned for this season. New registrations will appear here until they are
        auto-placed or you assign them.
      </p>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <select
          className="min-w-[min(100%,18rem)] max-w-full flex-1 rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm"
          value={selected}
          disabled={pending}
          onChange={(e) => {
            const registrationId = e.target.value;
            if (!registrationId) return;
            setMsg(null);
            startTransition(async () => {
              const r = await reassignRegistrationClassroomAction(
                registrationId,
                targetClassroomId,
                "Added from class page (was unassigned)",
              );
              setMsg(r.message);
              setSelected("");
              if (r.ok) router.refresh();
            });
          }}
          aria-label="Add an unassigned student to this class"
        >
          <option value="">Add unassigned student…</option>
          {candidates.map((c) => {
            const name = `${c.childFirstName} ${c.childLastName}`.trim() || "Student";
            const num = c.registrationNumber ? ` · ${c.registrationNumber}` : "";
            const detailText = c.details?.trim() ?? "";
            const tail = detailText ? ` — ${detailText}` : "";
            const fullTitle = [name, c.status, c.registrationNumber ?? "", detailText].filter(Boolean).join(" · ");
            return (
              <option key={c.registrationId} value={c.registrationId} title={fullTitle}>
                {name} · {c.status}
                {num}
                {tail}
              </option>
            );
          })}
        </select>
        {pending ? <span className="text-xs text-muted">Adding…</span> : null}
      </div>
      {msg ? <p className="text-xs text-foreground/75">{msg}</p> : null}
      <p className="text-xs text-muted">
        Students listed here have no class yet for this VBS season. Pick a name to assign them to{" "}
        <span className="font-medium text-foreground/80">this</span> class. Age or capacity warnings may appear after
        the move; you can still adjust from the registration record.
      </p>
    </div>
  );
}
