"use client";

import { useEffect, useId, useRef, useState } from "react";
import { X } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (pin: string) => void;
};

export function UndoCheckInPinModal({ open, onClose, onSubmit }: Props) {
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pin, setPin] = useState("");

  useEffect(() => {
    if (!open) {
      setPin("");
      return;
    }
    const timer = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => window.clearTimeout(timer);
  }, [open]);

  if (!open) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = pin.trim();
    if (!/^\d{4}$/.test(trimmed)) return;
    onSubmit(trimmed);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <div
        className="w-full max-w-sm overflow-hidden rounded-xl bg-background shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="flex items-start justify-between border-b border-foreground/10 px-5 py-4">
          <div>
            <h2 id={titleId} className="text-base font-semibold text-foreground">
              Security code required
            </h2>
            <p className="mt-1 text-sm text-muted">
              Enter the 4-digit code to undo this check-in.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 hover:bg-foreground/5"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4">
          <input
            ref={inputRef}
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={4}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
            placeholder="••••"
            className="w-full rounded-lg border border-foreground/15 bg-background px-4 py-3 text-center text-2xl tracking-[0.35em] text-foreground"
            aria-label="4-digit security code"
          />
          <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-foreground/15 px-4 py-2.5 text-sm font-medium hover:bg-foreground/5"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pin.length !== 4}
              className="rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-brand-foreground hover:opacity-90 disabled:opacity-50"
            >
              Confirm undo
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
