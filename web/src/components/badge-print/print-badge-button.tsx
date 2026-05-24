"use client";

import { useCallback, useState } from "react";
import type { BadgePrintPayload } from "@/lib/badge-print";
import { buildBadgePrintHtml, printBadgeDocument } from "@/lib/badge-print-document";

type Props = {
  registrationId: string;
  label?: string;
  className?: string;
  compact?: boolean;
  disabled?: boolean;
};

export function PrintBadgeButton({
  registrationId,
  label = "Print badge",
  className,
  compact = false,
  disabled = false,
}: Props) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePrint = useCallback(async () => {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/badge-print/${registrationId}`, {
        credentials: "same-origin",
      });
      const body = (await res.json()) as BadgePrintPayload | { error?: string };
      if (!res.ok) {
        throw new Error("error" in body && body.error ? body.error : "Could not load badge.");
      }
      const html = buildBadgePrintHtml(body as BadgePrintPayload);
      printBadgeDocument(html);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Print failed.");
    } finally {
      setPending(false);
    }
  }, [registrationId]);

  const baseClass = compact
    ? "rounded-lg border border-foreground/15 px-2.5 py-1.5 text-xs font-medium hover:bg-foreground/5 disabled:opacity-50"
    : "rounded-lg border border-foreground/15 px-3 py-2 text-sm font-medium hover:bg-foreground/5 disabled:opacity-50";

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => void handlePrint()}
        disabled={disabled || pending}
        className={className ?? baseClass}
      >
        {pending ? "Printing…" : label}
      </button>
      {error ? <span className="max-w-[12rem] text-right text-xs text-red-600">{error}</span> : null}
    </span>
  );
}

/** Fetch badge payload and open the system print dialog (for auto-print after check-in). */
export async function printBadgeByRegistrationId(registrationId: string): Promise<void> {
  const res = await fetch(`/api/badge-print/${registrationId}`, { credentials: "same-origin" });
  const body = (await res.json()) as BadgePrintPayload | { error?: string };
  if (!res.ok) {
    throw new Error("error" in body && body.error ? body.error : "Could not load badge.");
  }
  printBadgeDocument(buildBadgePrintHtml(body as BadgePrintPayload));
}
