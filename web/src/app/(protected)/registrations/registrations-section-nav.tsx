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
    href: "/registrations/forms",
    label: "Form builder",
    match: (p) => {
      if (p === "/registrations/forms") return true;
      const m = p.match(/^\/registrations\/forms\/([^/]+)(?:\/(.*))?$/);
      if (!m) return false;
      const rest = m[2] ?? "";
      if (rest.startsWith("submissions") || rest.startsWith("settings")) return false;
      return true;
    },
  },
  {
    href: "/registrations/submissions",
    label: "Submissions",
    match: (p) =>
      p.startsWith("/registrations/submissions") ||
      /\/registrations\/forms\/[^/]+\/submissions/.test(p),
  },
  {
    href: "/registrations/settings",
    label: "Settings",
    match: (p) =>
      p.startsWith("/registrations/settings") ||
      /\/registrations\/forms\/[^/]+\/settings/.test(p),
  },
];

export function RegistrationsSectionNav() {
  const pathname = usePathname();

  return (
    <nav
      className="flex flex-wrap gap-1 rounded-xl bg-foreground/[0.04] p-1 ring-1 ring-foreground/10"
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
                ? "rounded-lg bg-background px-4 py-2 text-sm font-semibold text-foreground shadow-sm ring-1 ring-foreground/10"
                : "rounded-lg px-4 py-2 text-sm font-medium text-foreground/65 transition hover:bg-background/80 hover:text-foreground"
            }
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
