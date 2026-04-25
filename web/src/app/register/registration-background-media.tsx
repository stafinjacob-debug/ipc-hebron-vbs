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
  const vid = videoUrl?.trim() || null;
  const img = imageUrl?.trim() || null;
  const dim = registrationBackgroundScrimAlpha(dimmingPercent);

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
      ? "pointer-events-none fixed inset-0 -z-20 scale-105 bg-cover bg-center bg-no-repeat [transform:translateZ(0)]"
      : "pointer-events-none absolute inset-0 z-0 bg-cover bg-center bg-no-repeat [transform:translateZ(0)]";

  const videoLayerClass =
    variant === "fixed"
      ? "pointer-events-none fixed inset-0 -z-20 h-full w-full object-cover [transform:translateZ(0)]"
      : "pointer-events-none absolute inset-0 z-0 h-full w-full object-cover [transform:translateZ(0)]";

  const scrimClass =
    variant === "fixed" ? "pointer-events-none fixed inset-0 -z-10" : "pointer-events-none absolute inset-0 z-[1]";

  return (
    <>
      {vid ? (
        <video
          aria-hidden
          className={videoLayerClass}
          src={vid}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
        />
      ) : (
        <div
          aria-hidden
          className={imageLayerClass}
          style={{ backgroundImage: `url(${JSON.stringify(img)})` }}
        />
      )}
      <div
        aria-hidden
        className={scrimClass}
        style={{ backgroundColor: `rgba(10, 10, 10, ${dim})` }}
      />
    </>
  );
}
