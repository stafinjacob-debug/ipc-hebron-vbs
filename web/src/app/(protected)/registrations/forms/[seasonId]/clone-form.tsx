"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cloneRegistrationFormFromSeason } from "../actions";

export function CloneRegistrationForm({
  targetSeasonId,
  seasons,
}: {
  targetSeasonId: string;
  seasons: Array<{ id: string; name: string; year: number }>;
}) {
  const router = useRouter();
  const [sourceId, setSourceId] = useState(seasons[0]?.id ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        setMsg(null);
        startTransition(async () => {
          const r = await cloneRegistrationFormFromSeason(targetSeasonId, sourceId);
          setMsg(r.message);
          if (r.ok) router.refresh();
        });
      }}
    >
      <div>
        <label htmlFor="cloneSource" className="block text-xs font-medium text-foreground/70">
          Source season
        </label>
        <select
          id="cloneSource"
          value={sourceId}
          onChange={(e) => setSourceId(e.target.value)}
          className="mt-1 min-w-[200px] rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm"
        >
          {seasons.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.year})
            </option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        disabled={pending || !sourceId}
        className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Cloning…" : "Clone into this season"}
      </button>
      {msg ? <p className="w-full text-sm text-foreground/80">{msg}</p> : null}
    </form>
  );
}
