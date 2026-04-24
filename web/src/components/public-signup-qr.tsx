"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";

type PublicSignupQrProps = {
  url: string;
  /** CSS display size of the square (generated bitmap is larger for sharpness). */
  displaySize?: number;
  className?: string;
};

export function PublicSignupQr({ url, displaySize = 200, className = "" }: PublicSignupQrProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void QRCode.toDataURL(url, {
      width: Math.max(256, Math.round(displaySize * 2)),
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#0f172a", light: "#ffffff" },
    })
      .then((d) => {
        if (!cancelled) {
          setDataUrl(d);
          setError(null);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setDataUrl(null);
          setError(e instanceof Error ? e.message : "Could not generate QR code.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [url, displaySize]);

  if (error) {
    return <p className={`text-xs text-red-700 dark:text-red-300 ${className}`}>{error}</p>;
  }

  if (!dataUrl) {
    return (
      <div
        className={`animate-pulse rounded-lg border border-foreground/10 bg-foreground/[0.06] ${className}`}
        style={{ width: displaySize, height: displaySize }}
        aria-busy
        aria-label="Generating QR code"
      />
    );
  }

  return (
    <div className={`flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4 ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- data URL from qrcode */}
      <img
        src={dataUrl}
        alt="QR code for the public signup link"
        width={displaySize}
        height={displaySize}
        className="shrink-0 rounded-lg border border-foreground/15 bg-white p-2 shadow-sm"
      />
      <div className="space-y-1 text-sm">
        <p className="text-foreground/65">Show on a projector or print for easy scanning.</p>
        <a
          href={dataUrl}
          download="public-signup-qr.png"
          className="inline-block font-medium text-brand underline hover:no-underline"
        >
          Download PNG
        </a>
      </div>
    </div>
  );
}
