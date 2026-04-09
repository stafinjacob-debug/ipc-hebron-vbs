"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const BASE = (id: string) => `/registrations/forms/${id}`;

type Tab = {
  href: (id: string) => string;
  label: string;
  end?: boolean;
  labelWithCount?: (count: number | undefined) => string;
};

const LINKS: Tab[] = [
  { href: (id) => BASE(id), label: "Overview", end: true },
  { href: (id) => `${BASE(id)}/edit`, label: "Form editor" },
  { href: (id) => `${BASE(id)}/settings`, label: "Settings" },
  { href: (id) => `${BASE(id)}/preview`, label: "Preview" },
  {
    href: (id) => `${BASE(id)}/submissions`,
    label: "Submissions",
    labelWithCount: (c) => (c != null ? `Submissions (${c})` : "Submissions"),
  },
];

export function RegistrationFormSubnav({
  seasonId,
  submissionCount,
}: {
  seasonId: string;
  submissionCount?: number;
}) {
  const pathname = usePathname();

  return (
    <nav
      className="flex flex-wrap gap-1 rounded-xl bg-foreground/[0.04] p-1 ring-1 ring-foreground/10"
      aria-label="Form views"
    >
      {LINKS.map((tab) => {
        const h = tab.href(seasonId);
        const active = tab.end ? pathname === h : pathname.startsWith(h);
        const label =
          tab.labelWithCount?.(submissionCount) ?? tab.label;
        return (
          <Link
            key={tab.label}
            href={h}
            className={
              active
                ? "rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground shadow-sm ring-1 ring-brand/30"
                : "rounded-lg px-4 py-2 text-sm font-medium text-foreground/70 transition hover:bg-background/90 hover:text-foreground"
            }
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
