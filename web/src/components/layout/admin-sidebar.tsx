"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { UserRole } from "@/generated/prisma";
import { canSeeMainNavLink } from "@/lib/permissions";

const NAV: { href: string; label: string; match: (pathname: string) => boolean }[] = [
  { href: "/dashboard", label: "Dashboard", match: (p) => p === "/dashboard" },
  {
    href: "/registrations",
    label: "Registrations",
    match: (p) => p === "/registrations" || p.startsWith("/registrations/"),
  },
  { href: "/students", label: "Students", match: (p) => p === "/students" || p.startsWith("/students/") },
  { href: "/classes", label: "Classes", match: (p) => p === "/classes" || p.startsWith("/classes/") },
  {
    href: "/check-in",
    label: "Check-In",
    match: (p) => p === "/check-in" || p.startsWith("/check-in/"),
  },
  {
    href: "/content/announcements",
    label: "Content",
    match: (p) => p.startsWith("/content"),
  },
  { href: "/reports", label: "Reports", match: (p) => p === "/reports" || p.startsWith("/reports/") },
  { href: "/settings", label: "Settings", match: (p) => p === "/settings" || p.startsWith("/settings/") },
];

export function AdminSidebar({
  role,
  mobileOpen,
  onMobileClose,
}: {
  role: UserRole;
  mobileOpen: boolean;
  onMobileClose: () => void;
}) {
  const pathname = usePathname();
  const navItems = NAV.filter((item) => canSeeMainNavLink(role, item.href));

  return (
    <>
      {mobileOpen ? (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={onMobileClose}
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-60 max-w-[88vw] flex-col border-r border-foreground/10 bg-surface-elevated transition-transform duration-200 md:static md:max-w-none md:translate-x-0 ${
          mobileOpen ? "translate-x-0 shadow-xl" : "-translate-x-full"
        } md:shadow-none`}
      >
        <div className="border-b border-foreground/10 px-4 py-5">
          <Link href="/dashboard" className="block min-w-0" onClick={onMobileClose}>
            <span className="block text-base font-semibold tracking-tight text-foreground">
              <span className="text-brand">IPC Hebron</span> VBS
            </span>
            <span className="mt-1 block text-xs font-medium text-foreground/55">Admin Portal</span>
            <span className="mt-2 inline-flex rounded-md bg-foreground/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-foreground/70">
              Staff
            </span>
          </Link>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3" aria-label="Main">
          {navItems.map((item) => {
            const active = item.match(pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onMobileClose}
                className={
                  active
                    ? "rounded-lg border-l-[3px] border-brand bg-brand/10 py-2.5 pl-3 pr-3 text-sm font-semibold text-foreground"
                    : "rounded-lg border-l-[3px] border-transparent py-2.5 pl-3 pr-3 text-sm font-medium text-foreground/65 transition hover:bg-foreground/[0.05] hover:text-foreground"
                }
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
