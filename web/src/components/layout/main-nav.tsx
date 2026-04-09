"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const PRIMARY_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/registrations", label: "Registrations" },
  { href: "/students", label: "Students" },
  { href: "/classes", label: "Classes" },
  { href: "/check-in", label: "Check-In" },
  { href: "/content/announcements", label: "Content" },
  { href: "/reports", label: "Reports" },
  { href: "/settings", label: "Settings" },
] as const;

function linkIsActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  if (href === "/content/announcements") return pathname.startsWith("/content");
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MainNav() {
  const pathname = usePathname();

  return (
    <nav
      className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1 gap-y-1 border-t border-foreground/10 pt-3 sm:gap-x-2 lg:border-t-0 lg:pt-0"
      aria-label="Main"
    >
      {PRIMARY_LINKS.map((item) => {
        const active = linkIsActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={
              active
                ? "rounded-lg bg-brand/12 px-3 py-2 text-sm font-semibold text-brand ring-1 ring-brand/25 dark:bg-brand/20 dark:ring-brand/35"
                : "rounded-lg px-3 py-2 text-sm font-medium text-foreground/70 transition hover:bg-foreground/[0.06] hover:text-foreground"
            }
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
