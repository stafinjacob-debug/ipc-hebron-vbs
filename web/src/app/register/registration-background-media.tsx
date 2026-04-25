 "use client";

import { useEffect, useRef, useState } from "react";
import { registrationBackgroundScrimAlpha } from "@/lib/registration-background-scrim";

export type RegistrationBackgroundMediaProps = {
  videoUrl: string | null | undefined;
  imageUrl: string | null | undefined;
  dimmingPercent: number;
  variant: "fixed" | "split";
};

/** Full-bleed image or looping video plus dim scrim for public registration surfaces. */
export function RegistrationBackgroundMedia({
  videoUrl,
  imageUrl,
  dimmingPercent,
  variant,
}: RegistrationBackgroundMediaProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoReady, setVideoReady] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const vid = videoUrl?.trim() || null;
  const img = imageUrl?.trim() || null;
  const dim = registrationBackgroundScrimAlpha(dimmingPercent);

  useEffect(() => {
    setVideoReady(false);
    setVideoFailed(false);
  }, [vid]);

  useEffect(() => {
    if (!vid) return;
    const playVideo = () => {
      const video = videoRef.current;
      if (!video) return;
      if (!video.paused) return;
      void video.play().catch(() => {
        // Some browsers may still block; keep listener for next gesture.
      });
    };

    const onFirstUserGesture = () => {
      playVideo();
      if (!videoRef.current?.paused) {
        document.removeEventListener("pointerdown", onFirstUserGesture, true);
        document.removeEventListener("touchstart", onFirstUserGesture, true);
        document.removeEventListener("click", onFirstUserGesture, true);
      }
    };

    document.addEventListener("pointerdown", onFirstUserGesture, true);
    document.addEventListener("touchstart", onFirstUserGesture, true);
    document.addEventListener("click", onFirstUserGesture, true);

    playVideo();

    return () => {
      document.removeEventListener("pointerdown", onFirstUserGesture, true);
      document.removeEventListener("touchstart", onFirstUserGesture, true);
      document.removeEventListener("click", onFirstUserGesture, true);
    };
  }, [vid]);

  if (!vid && !img) {
    if (variant === "fixed") {
      return (
        <div className="pointer-events-none fixed inset-0 -z-10 bg-gradient-to-b from-brand-muted/45 via-background to-background dark:from-brand-muted/15" />
      );
    }
    return (
      <div className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-b from-brand-muted/55 via-neutral-100 to-neutral-200 dark:from-brand-muted/25 dark:via-neutral-900 dark:to-neutral-950" />
    );
  }

  const imageLayerClass =
    variant === "fixed"
      ? "pointer-events-none fixed inset-0 -z-20 scale-[1.12] bg-cover bg-center bg-no-repeat transition-transform duration-[12000ms] ease-out [transform:translateZ(0)]"
      : "pointer-events-none absolute inset-0 z-0 bg-cover bg-[52%_center] bg-no-repeat [transform:translateZ(0)]";

  const videoLayerClass =
    variant === "fixed"
      ? "pointer-events-none fixed inset-0 -z-20 h-full w-full scale-[1.06] object-cover transition-transform duration-[12000ms] ease-out [transform:translateZ(0)]"
      : "pointer-events-none absolute inset-0 z-0 h-full w-full object-cover object-[52%_center] [transform:translateZ(0)]";

  const scrimClass =
    variant === "fixed"
      ? "pointer-events-none fixed inset-0 -z-10"
      : "pointer-events-none absolute inset-0 z-[1]";

  return (
    <>
      {img ? (
        <div
          aria-hidden
          className={imageLayerClass}
          style={{ backgroundImage: `url(${JSON.stringify(img)})` }}
        />
      ) : null}
      {vid && !videoFailed ? (
        <video
          ref={videoRef}
          aria-hidden
          className={`${videoLayerClass} transition-opacity duration-500 ${videoReady ? "opacity-100" : "opacity-0"}`}
          src={vid}
          poster={img ?? undefined}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          onLoadedData={() => setVideoReady(true)}
          onCanPlay={() => setVideoReady(true)}
          onPlay={() => setVideoReady(true)}
          onError={() => {
            setVideoFailed(true);
            setVideoReady(false);
          }}
        />
      ) : null}
      <div
        aria-hidden
        className={scrimClass}
        style={
          variant === "fixed"
            ? {
                background: `radial-gradient(circle at 50% 35%, rgba(10, 10, 10, ${Math.min(
                  0.62,
                  dim + 0.2,
                )}) 0%, rgba(8, 8, 8, ${Math.min(0.82, dim + 0.32)}) 58%, rgba(6, 6, 6, ${Math.min(
                  0.9,
                  dim + 0.4,
                )}) 100%)`,
              }
            : {
                background: `linear-gradient(180deg,
                  rgba(255, 255, 255, 0.12) 0%,
                  rgba(255, 255, 255, 0.06) 42%,
                  rgba(10, 16, 28, ${Math.min(0.28, dim + 0.05)}) 100%)`,
              }
        }
      />
    </>
  );
}
