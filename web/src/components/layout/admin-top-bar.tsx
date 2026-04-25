"use client";

import Link from "next/link";
import { Bell, Menu, Search } from "lucide-react";
import { OrganizationLogo } from "@/components/layout/organization-logo";
import { SeasonSwitcher } from "@/components/layout/season-switcher";
import { UserAccountMenu } from "@/components/layout/user-account-menu";
import type { UserRole } from "@/generated/prisma";

export function AdminTopBar({
  email,
  displayName,
  role,
  seasons,
  onMenuClick,
}: {
  email: string;
  displayName: string | null;
  role: UserRole;
  seasons: { id: string; name: string; year: number }[];
  onMenuClick: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-foreground/10 bg-background/90 px-4 py-3 backdrop-blur-md sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-3 lg:gap-x-6">
        <div className="flex shrink-0 items-center gap-1 md:contents">
          <button
            type="button"
            aria-label="Open sidebar"
            className="rounded-lg p-2 text-foreground hover:bg-foreground/[0.06] md:hidden"
            onClick={onMenuClick}
          >
            <Menu className="size-6" aria-hidden />
          </button>
          <Link
            href="/dashboard"
            className="rounded-lg p-1 md:hidden"
            aria-label="IPC Hebron Houston — dashboard home"
          >
            <OrganizationLogo className="h-9 w-9 object-contain" />
          </Link>
        </div>

        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3 sm:gap-4">
          <SeasonSwitcher seasons={seasons} />
          <div className="hidden h-8 w-px bg-foreground/10 sm:block" aria-hidden />
          <div className="flex items-center gap-1.5 rounded-lg border border-foreground/10 bg-foreground/[0.02] px-1 py-1">
            <button
              type="button"
              disabled
              title="Search (coming soon)"
              className="rounded-md p-1.5 text-foreground/35"
              aria-disabled
            >
              <Search className="size-4" aria-hidden />
            </button>
            <button
              type="button"
              disabled
              title="Notifications (coming soon)"
              className="rounded-md p-1.5 text-foreground/35"
              aria-disabled
            >
              <Bell className="size-4" aria-hidden />
            </button>
          </div>
        </div>

        <div className="ml-auto flex shrink-0 items-center">
          <UserAccountMenu email={email} displayName={displayName} role={role} />
        </div>
      </div>
    </header>
  );
}
