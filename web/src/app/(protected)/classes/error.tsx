"use client";

export default function ClassesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const msg = (error.message || "").toLowerCase();
  const looksLikeDb =
    msg.includes("column") ||
    msg.includes("does not exist") ||
    msg.includes("matchformfield") ||
    msg.includes("unknown arg") ||
    msg.includes("prisma");

  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 py-12">
      <h1 className="text-xl font-semibold text-foreground">Classes couldn’t load</h1>
      <p className="text-sm text-foreground/80">
        The server hit an error while loading this page. This often happens right after a deploy if
        the production database hasn’t received the latest schema update.
      </p>
      {looksLikeDb ? (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100">
          <p className="font-medium">Database migration likely needed</p>
          <p className="mt-2 text-amber-900/90 dark:text-amber-100/90">
            Run{" "}
            <code className="rounded bg-foreground/10 px-1 py-0.5 text-xs">npx prisma migrate deploy</code>{" "}
            against the <strong>same</strong> <code className="text-xs">DATABASE_URL</code> the App
            Service uses (not only the CI secret, if they differ). Then restart the site or redeploy.
          </p>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground"
        >
          Try again
        </button>
        <a
          href="/dashboard"
          className="inline-flex items-center rounded-lg border border-foreground/20 px-4 py-2 text-sm font-medium"
        >
          Back to dashboard
        </a>
      </div>
      {process.env.NODE_ENV === "development" ? (
        <pre className="mt-4 max-h-40 overflow-auto rounded bg-foreground/5 p-3 text-xs">{error.message}</pre>
      ) : null}
    </div>
  );
}
