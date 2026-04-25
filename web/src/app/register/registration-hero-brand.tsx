"use client";

import Image from "next/image";

export const REGISTRATION_CHURCH_LOGO_SRC = "/church-logo.png";

/** Church mark above the organization name on public registration heroes. */
export function RegistrationHeroBrand({ churchDisplayName }: { churchDisplayName: string }) {
  return (
    <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-white/90 p-2 shadow-md ring-1 ring-brand/25 dark:bg-neutral-950/70 dark:ring-brand/35">
      <Image
        src={REGISTRATION_CHURCH_LOGO_SRC}
        alt={churchDisplayName}
        width={160}
        height={160}
        sizes="64px"
        className="h-12 w-auto max-w-[5.5rem] object-contain"
        priority
      />
    </div>
  );
}
