"use client";

import { useState } from "react";
import type { UserRole } from "@/generated/prisma";
import { canViewOperations } from "@/lib/roles";
import { AdminSidebar } from "@/components/layout/admin-sidebar";
import { AdminTopBar } from "@/components/layout/admin-top-bar";

export function AppShell({
  email,
  displayName,
  role,
  seasons,
  databaseNotice,
  children,
}: {
  email: string;
  displayName: string | null;
  role: UserRole;
  seasons: { id: string; name: string; year: number }[];
  /** Shown when the app could not load seasons from the database (connection issues). */
  databaseNotice?: string | null;
  children: React.ReactNode;
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const ops = canViewOperations(role);

  return (
    <div className="flex min-h-full bg-background">
      {ops ? (
        <>
          <AdminSidebar
            role={role}
            mobileOpen={mobileNavOpen}
            onMobileClose={() => setMobileNavOpen(false)}
          />
          <div className="flex min-h-full min-w-0 flex-1 flex-col">
            <AdminTopBar
              email={email}
              displayName={displayName}
              role={role}
              seasons={seasons}
              onMenuClick={() => setMobileNavOpen(true)}
            />
            {databaseNotice ? (
              <div
                className="border-b border-amber-500/40 bg-amber-500/10 px-4 py-2 text-center text-sm text-amber-950 dark:text-amber-100"
                role="status"
              >
                {databaseNotice}
              </div>
            ) : null}
            <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
              {children}
            </main>
          </div>
        </>
      ) : (
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      )}
    </div>
  );
}
