"use client";

import type { ReactNode } from "react";
import { useState, useTransition } from "react";
import { cancelSubmissionByTokenAction } from "./actions";

function PageShell({ children }: { children: ReactNode }) {
  return <div className="mx-auto min-h-[50vh] max-w-lg px-4 py-16">{children}</div>;
}

function Card({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-700 dark:bg-neutral-950">
      {children}
    </div>
  );
}

export function CancelRegistrationForm({
  token,
  seasonName,
  registrationCode,
  childNames,
}: {
  token: string;
  seasonName: string;
  registrationCode: string;
  childNames: string[];
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  if (result?.ok) {
    return (
      <PageShell>
        <Card>
          <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">Registration cancelled</h1>
          <p className="mt-3 text-sm text-neutral-700 dark:text-neutral-300">{result.message}</p>
          <p className="mt-4 text-sm text-neutral-600 dark:text-neutral-400">
            <strong>{seasonName}</strong>
          </p>
          <a
            href="/register"
            className="mt-6 inline-block rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
          >
            Back to registration
          </a>
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <Card>
        <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">Cancel registration</h1>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          <strong>{seasonName}</strong> · Reference <span className="font-mono">{registrationCode}</span>
        </p>
        {childNames.length > 0 ? (
          <ul className="mt-4 list-inside list-disc text-sm text-neutral-700 dark:text-neutral-300">
            {childNames.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        ) : null}
        <p className="mt-4 text-sm text-neutral-600 dark:text-neutral-400">
          Confirming will withdraw this registration. You will not be charged for an unfinished checkout.
        </p>
        {result && !result.ok ? (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100">
            {result.message}
          </p>
        ) : null}
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={pending}
            className="rounded-lg bg-red-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50"
            onClick={() => {
              if (!confirm("Cancel this registration for all children listed above?")) return;
              startTransition(async () => {
                const r = await cancelSubmissionByTokenAction(token);
                setResult(r);
              });
            }}
          >
            {pending ? "Cancelling…" : "Yes, cancel my registration"}
          </button>
          <a
            href="/register"
            className="rounded-lg border border-neutral-300 px-4 py-2.5 text-sm font-medium text-neutral-800 hover:bg-neutral-50 dark:border-neutral-600 dark:text-neutral-200 dark:hover:bg-neutral-900"
          >
            Keep registration
          </a>
        </div>
      </Card>
    </PageShell>
  );
}
