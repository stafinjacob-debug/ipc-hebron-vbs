import Image from "next/image";

export const ORGANIZATION_LOGO_SRC = "/IPCHebronHouston_Logo.png";

type OrganizationLogoProps = {
  className?: string;
  /** Set on LCP / above-the-fold usage (e.g. public landing). */
  priority?: boolean;
  /** Passed to `next/image` for responsive srcset (match rendered width). */
  sizes?: string;
};

export function OrganizationLogo({ className, priority, sizes = "112px" }: OrganizationLogoProps) {
  return (
    <Image
      src={ORGANIZATION_LOGO_SRC}
      alt="IPC Hebron Houston"
      width={500}
      height={500}
      sizes={sizes}
      className={className ?? "h-10 w-10 shrink-0 object-contain"}
      priority={priority}
    />
  );
}
