"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const BASE = (id: string) => `/registrations/forms/${id}`;

type Tab = {
  href: (id: string) => string;
  label: string;
  end?: boolean;
};

const WORKSPACE = (id: string) => `/registrations/form-workspace/${id}`;

const LINKS: Tab[] = [
  { href: (id) => BASE(id), label: "Overview", end: true },
  { href: (id) => WORKSPACE(id), label: "Form editor" },
  { href: (id) => `${WORKSPACE(id)}?tab=settings`, label: "Settings" },
  { href: (id) => `${WORKSPACE(id)}?tab=preview`, label: "Preview" },
];

export function RegistrationFormSubnav({
  seasonId,
}: {
  seasonId: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const workspacePath = WORKSPACE(seasonId);
  const onWorkspace = pathname === workspacePath;
  const workspaceTab = searchParams.get("tab");

  return (
    <nav
      className="flex flex-wrap gap-1 rounded-xl bg-foreground/[0.04] p-1 ring-1 ring-foreground/10"
      aria-label="Form views"
    >
      {LINKS.map((tab) => {
        const h = tab.href(seasonId);
        const active = tab.end
          ? pathname === h
          : tab.label === "Form editor"
            ? (onWorkspace && (!workspaceTab || workspaceTab === "fields")) ||
              pathname.startsWith(`${BASE(seasonId)}/edit`)
            : tab.label === "Settings"
              ? (onWorkspace && workspaceTab === "settings") || pathname.startsWith(`${BASE(seasonId)}/settings`)
              : tab.label === "Preview"
                ? (onWorkspace && workspaceTab === "preview") || pathname.startsWith(`${BASE(seasonId)}/preview`)
                : pathname.startsWith(h);
        const label = tab.label;
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
