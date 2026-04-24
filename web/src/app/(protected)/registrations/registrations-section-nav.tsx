"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS: {
  href: string;
  label: string;
  match: (p: string) => boolean;
}[] = [
  {
    href: "/registrations",
    label: "Overview",
    match: (p) => p === "/registrations" || p.startsWith("/registrations/new"),
  },
  {
    href: "/registrations/students",
    label: "Students",
    match: (p) => p === "/registrations/students" || p.startsWith("/registrations/students/"),
  },
];

export function RegistrationsSectionNav() {
  const pathname = usePathname();

  return (
    <nav
      className="flex flex-wrap gap-1 border-b border-foreground/10 pb-2"
      aria-label="Registrations section"
    >
      {TABS.map((tab) => {
        const active = tab.match(pathname);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={
              active
                ? "rounded-md border border-foreground/10 bg-foreground/[0.04] px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-foreground"
                : "rounded-md px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-foreground/50 transition hover:bg-foreground/[0.04] hover:text-foreground/80"
            }
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
