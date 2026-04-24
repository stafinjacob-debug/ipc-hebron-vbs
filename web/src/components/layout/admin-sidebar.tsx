"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import {
  BarChart3,
  BookOpenText,
  ClipboardCheck,
  LayoutDashboard,
  Megaphone,
  Settings,
  UserSquare2,
} from "lucide-react";
import type { UserRole } from "@/generated/prisma";
import { canSeeMainNavLink } from "@/lib/permissions";

const NAV: {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  match: (pathname: string) => boolean;
  children?: { href: string; label: string; match: (pathname: string) => boolean }[];
}[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, match: (p) => p === "/dashboard" },
  {
    href: "/registrations",
    label: "Registrations",
    icon: ClipboardCheck,
    match: (p) => p === "/registrations" || p.startsWith("/registrations/"),
    children: [
      {
        href: "/registrations",
        label: "All registrations",
        match: (p) => p === "/registrations" || p.startsWith("/registrations/new") || /^\/registrations\/[^/]+$/.test(p),
      },
      {
        href: "/registrations/forms",
        label: "Form Builder",
        match: (p) => p === "/registrations/forms" || p.startsWith("/registrations/forms/"),
      },
      {
        href: "/registrations/students",
        label: "Students",
        match: (p) => p === "/registrations/students" || p.startsWith("/registrations/students/"),
      },
    ],
  },
  { href: "/classes", label: "Classes", icon: UserSquare2, match: (p) => p === "/classes" || p.startsWith("/classes/") },
  {
    href: "/check-in",
    label: "Check-In",
    icon: BookOpenText,
    match: (p) => p === "/check-in" || p.startsWith("/check-in/"),
  },
  {
    href: "/content/announcements",
    label: "Content",
    icon: Megaphone,
    match: (p) => p.startsWith("/content"),
  },
  { href: "/reports", label: "Reports", icon: BarChart3, match: (p) => p === "/reports" || p.startsWith("/reports/") },
  { href: "/settings", label: "Settings", icon: Settings, match: (p) => p === "/settings" || p.startsWith("/settings/") },
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
  const navItems = NAV
    .filter((item) => canSeeMainNavLink(role, item.href))
    .map((item) => ({
      ...item,
      children: item.children?.filter((child) => canSeeMainNavLink(role, child.href)),
    }));

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
        className={`fixed inset-y-0 left-0 z-50 flex w-56 max-w-[88vw] flex-col border-r border-foreground/10 bg-surface-elevated transition-transform duration-200 md:static md:max-w-none md:translate-x-0 ${
          mobileOpen ? "translate-x-0 shadow-xl" : "-translate-x-full"
        } md:shadow-none`}
      >
        <div className="border-b border-foreground/10 px-4 py-4">
          <Link href="/dashboard" className="block min-w-0" onClick={onMobileClose}>
            <span className="block text-[15px] font-semibold tracking-tight text-foreground">
              <span className="text-brand">IPC Hebron</span> VBS
            </span>
            <span className="mt-1 block text-[11px] font-medium text-foreground/50">Admin Portal</span>
            <span className="mt-2 inline-flex rounded-md border border-foreground/10 bg-foreground/[0.04] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-foreground/55">
              Staff
            </span>
          </Link>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2.5" aria-label="Main">
          {navItems.map((item) => {
            const active = item.match(pathname);
            const Icon = item.icon;
            return (
              <div key={item.href} className="space-y-0.5">
                <Link
                  href={item.href}
                  onClick={onMobileClose}
                  className={
                    active
                      ? "flex items-center gap-2 rounded-md bg-brand/[0.12] px-2.5 py-2 text-sm font-semibold text-foreground"
                      : "flex items-center gap-2 rounded-md px-2.5 py-2 text-sm font-medium text-foreground/65 transition hover:bg-foreground/[0.05] hover:text-foreground"
                  }
                >
                  <Icon className={`size-4 shrink-0 ${active ? "text-brand" : "text-foreground/45"}`} />
                  {item.label}
                </Link>
                {item.children?.map((child) => {
                  const childActive = child.match(pathname);
                  return (
                    <Link
                      key={child.href}
                      href={child.href}
                      onClick={onMobileClose}
                      className={
                        childActive
                          ? "ml-6 block rounded-md bg-brand/[0.08] px-2.5 py-1 text-[11px] font-medium text-foreground/80"
                          : "ml-6 block rounded-md px-2.5 py-1 text-[11px] font-normal text-foreground/55 hover:bg-foreground/[0.05] hover:text-foreground/80"
                      }
                    >
                      {child.label}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
