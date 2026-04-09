"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function SettingsSubnav({ showUsers }: { showUsers: boolean }) {
  const pathname = usePathname();

  const tabs: { href: string; label: string; match: (p: string) => boolean }[] = [
    { href: "/settings", label: "General", match: (p: string) => p === "/settings" },
    ...(showUsers
      ? [
          {
            href: "/settings/users",
            label: "Users & access",
            match: (p: string) => p.startsWith("/settings/users"),
          },
        ]
      : []),
    {
      href: "/settings/roles",
      label: "Roles",
      match: (p: string) => p === "/settings/roles",
    },
    ...(showUsers
      ? [
          {
            href: "/settings/audit-log",
            label: "Audit log",
            match: (p: string) => p === "/settings/audit-log",
          },
        ]
      : []),
  ];

  return (
    <nav
      className="flex flex-wrap gap-1 border-b border-foreground/10 pb-3"
      aria-label="Settings sections"
    >
      {tabs.map((tab) => {
        const active = tab.match(pathname);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={
              active
                ? "rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background"
                : "rounded-full px-4 py-2 text-sm font-medium text-foreground/65 hover:bg-foreground/[0.06] hover:text-foreground"
            }
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
