"use client";

import { useState } from "react";
import type { UserRole } from "@/generated/prisma";
import { InviteUserForm } from "./invite-user-form";

export function InviteUserButton({
  seasons,
  classrooms,
  actorRole,
}: {
  seasons: { id: string; label: string }[];
  classrooms: { id: string; label: string }[];
  actorRole: UserRole;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground"
      >
        Invite user
      </button>
      {open ? (
        <InviteUserForm
          seasons={seasons}
          classrooms={classrooms}
          actorRole={actorRole}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
