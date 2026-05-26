"use client";

import { useEffect, useId, useRef, useState } from "react";
import { X } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
  onScan: (decodedText: string) => void;
};

export function CheckInQrScanner({ open, onClose, onScan }: Props) {
  const regionId = useId().replace(/:/g, "");
  const scannerRef = useRef<{ stop: () => Promise<void>; clear: () => void } | null>(null);
  const onScanRef = useRef(onScan);
  const onCloseRef = useRef(onClose);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    onScanRef.current = onScan;
    onCloseRef.current = onClose;
  }, [onScan, onClose]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setError(null);
    setStarting(true);

    (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled) return;

        const scanner = new Html5Qrcode(regionId);
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: (viewfinderWidth, viewfinderHeight) => {
              const size = Math.min(viewfinderWidth, viewfinderHeight) * 0.72;
              return { width: size, height: size };
            },
          },
          (decodedText) => {
            onScanRef.current(decodedText);
            void scanner.stop().then(() => scanner.clear());
            scannerRef.current = null;
            onCloseRef.current();
          },
          () => {
            /* scan failures are normal while searching */
          },
        );
        if (!cancelled) setStarting(false);
      } catch (e) {
        if (!cancelled) {
          setStarting(false);
          setError(
            e instanceof Error
              ? e.message
              : "Could not open the camera. Check browser permissions or enter the code manually.",
          );
        }
      }
    })();

    return () => {
      cancelled = true;
      const scanner = scannerRef.current;
      scannerRef.current = null;
      if (scanner) {
        void scanner.stop().then(() => scanner.clear()).catch(() => {});
      }
    };
  }, [open, regionId]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <div className="w-full max-w-lg overflow-hidden rounded-xl bg-background shadow-xl">
        <div className="flex items-center justify-between border-b border-foreground/10 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold">Scan check-in QR code</h2>
            <p className="text-xs text-muted">Point the camera at the ticket or badge QR code.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 hover:bg-foreground/5"
            aria-label="Close scanner"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="p-4">
          {error ? (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-800 dark:text-red-200">
              {error}
            </div>
          ) : null}
          <div
            id={regionId}
            className="mx-auto mt-2 min-h-[240px] w-full overflow-hidden rounded-lg bg-black/90"
          />
          {starting && !error ? (
            <p className="mt-2 text-center text-xs text-muted">Starting camera…</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
