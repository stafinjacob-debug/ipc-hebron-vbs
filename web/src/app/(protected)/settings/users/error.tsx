"use client";

export default function SettingsUsersError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-lg space-y-4 py-8">
      <h1 className="text-xl font-semibold text-foreground">User details couldn&apos;t load</h1>
      <p className="text-sm text-foreground/80">
        The server hit an error while opening this user. Try again, or return to the users list.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground"
        >
          Try again
        </button>
        <a
          href="/settings/users"
          className="inline-flex items-center rounded-lg border border-foreground/20 px-4 py-2 text-sm font-medium"
        >
          Back to users
        </a>
      </div>
      {process.env.NODE_ENV === "development" ? (
        <pre className="mt-4 max-h-40 overflow-auto rounded bg-foreground/5 p-3 text-xs">{error.message}</pre>
      ) : null}
    </div>
  );
}
