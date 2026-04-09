"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/content/announcements", label: "Announcements" },
  { href: "/content/documents", label: "Documents" },
] as const;

export function ContentSubNav() {
  const pathname = usePathname();

  return (
    <nav
      className="mt-5 flex gap-1 border-b border-foreground/10 pb-px"
      aria-label="Content sections"
    >
      {tabs.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={
              active
                ? "-mb-px border-b-2 border-brand px-4 py-2.5 text-sm font-semibold text-brand"
                : "px-4 py-2.5 text-sm font-medium text-muted transition hover:text-foreground"
            }
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
