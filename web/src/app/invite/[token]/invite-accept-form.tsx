"use client";

import { useActionState } from "react";
import Link from "next/link";
import { acceptInviteSetup, type InviteAcceptState } from "../actions";

const initial: InviteAcceptState | null = null;

export function InviteAcceptForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(acceptInviteSetup, initial);

  if (state?.ok) {
    return (
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-6 text-center">
        <p className="font-semibold text-foreground">{state.message}</p>
        <Link
          href="/login"
          className="mt-4 inline-flex rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground"
        >
          Go to sign in
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      {state && !state.ok ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-100">
          {state.message}
        </p>
      ) : null}
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-foreground">
          Create password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className="mt-1 w-full rounded-lg border border-foreground/15 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label htmlFor="confirm" className="block text-sm font-medium text-foreground">
          Confirm password
        </label>
        <input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className="mt-1 w-full rounded-lg border border-foreground/15 px-3 py-2 text-sm"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-brand py-2.5 text-sm font-semibold text-brand-foreground disabled:opacity-50"
      >
        {pending ? "Saving…" : "Activate account"}
      </button>
    </form>
  );
}
