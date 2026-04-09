"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  publishRegistrationForm,
  resetDraftFromPublished,
  setRegistrationFormStatus,
} from "../actions";
import type { RegistrationFormStatus } from "@/generated/prisma";

export function LifecycleActions({
  seasonId,
  status,
}: {
  seasonId: string;
  status: RegistrationFormStatus;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function run(fn: () => Promise<{ ok: boolean; message: string }>) {
    setMsg(null);
    startTransition(async () => {
      const r = await fn();
      setMsg(r.message);
      if (r.ok) router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => publishRegistrationForm(seasonId))}
          className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 dark:bg-emerald-700"
        >
          Publish draft
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => resetDraftFromPublished(seasonId))}
          className="rounded-md border border-foreground/20 px-3 py-2 text-sm font-medium hover:bg-foreground/[0.04] disabled:opacity-50"
        >
          Reset draft from published
        </button>
        {status === "PUBLISHED" ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => setRegistrationFormStatus(seasonId, "DRAFT"))}
            className="rounded-md border border-foreground/20 px-3 py-2 text-sm font-medium hover:bg-foreground/[0.04] disabled:opacity-50"
          >
            Unpublish (draft)
          </button>
        ) : null}
        {status !== "ARCHIVED" ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => setRegistrationFormStatus(seasonId, "ARCHIVED"))}
            className="rounded-md border border-foreground/20 px-3 py-2 text-sm font-medium text-foreground/80 hover:bg-foreground/[0.04] disabled:opacity-50"
          >
            Archive
          </button>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => setRegistrationFormStatus(seasonId, "DRAFT"))}
            className="rounded-md border border-foreground/20 px-3 py-2 text-sm font-medium hover:bg-foreground/[0.04] disabled:opacity-50"
          >
            Restore from archive (draft)
          </button>
        )}
      </div>
      {msg ? <p className="text-sm text-foreground/80">{msg}</p> : null}
    </div>
  );
}
