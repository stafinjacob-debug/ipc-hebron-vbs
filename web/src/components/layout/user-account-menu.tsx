"use client";

import { ChevronDown, LogOut, UserRound } from "lucide-react";
import { signOut } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import type { UserRole } from "@/generated/prisma";
import { roleLabel } from "@/lib/roles";

function initials(email: string, name: string | null) {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/);
    const a = parts[0]?.[0] ?? "";
    const b = parts[1]?.[0] ?? "";
    return (a + b).toUpperCase() || a.toUpperCase() || "?";
  }
  const local = email.split("@")[0] ?? "?";
  return local.slice(0, 2).toUpperCase();
}

export function UserAccountMenu({
  email,
  displayName,
  role,
}: {
  email: string;
  displayName: string | null;
  role: UserRole;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, []);

  const ini = initials(email, displayName);

  return (
    <div className="relative flex items-center" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-xl border border-foreground/10 bg-foreground/[0.03] px-2 py-1.5 pl-2 pr-2 text-left hover:bg-foreground/[0.06]"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand/15 text-xs font-bold text-brand"
          aria-hidden
        >
          {ini}
        </span>
        <span className="hidden min-w-0 sm:block">
          <span className="block max-w-[160px] truncate text-sm font-medium text-foreground">
            {displayName?.trim() || email}
          </span>
          <span className="mt-0.5 inline-flex rounded-md bg-foreground/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-foreground/70">
            {roleLabel(role)}
          </span>
        </span>
        <ChevronDown className="hidden size-4 shrink-0 text-foreground/45 sm:block" aria-hidden />
      </button>
      {open ? (
        <div
          className="absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border border-foreground/15 bg-background py-1 shadow-lg"
          role="menu"
        >
          <div className="border-b border-foreground/10 px-3 py-2 sm:hidden">
            <p className="truncate text-sm font-medium">{displayName?.trim() || email}</p>
            <p className="text-xs text-foreground/60">{roleLabel(role)}</p>
          </div>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground/80 hover:bg-foreground/[0.05]"
            onClick={() => setOpen(false)}
          >
            <UserRound className="size-4" aria-hidden />
            Profile
            <span className="ml-auto text-[10px] text-foreground/45">Soon</span>
          </button>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground/80 hover:bg-foreground/[0.05]"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            <LogOut className="size-4" aria-hidden />
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
