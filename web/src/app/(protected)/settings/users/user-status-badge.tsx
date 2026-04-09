import type { UserStatus } from "@/generated/prisma";

const styles: Record<UserStatus, string> = {
  INVITED: "bg-sky-500/15 text-sky-900 dark:text-sky-100",
  PENDING_SETUP: "bg-amber-500/15 text-amber-900 dark:text-amber-100",
  ACTIVE: "bg-emerald-500/15 text-emerald-900 dark:text-emerald-100",
  SUSPENDED: "bg-orange-500/15 text-orange-950 dark:text-orange-100",
  DISABLED: "bg-foreground/10 text-foreground/70",
};

const labels: Record<UserStatus, string> = {
  INVITED: "Invited",
  PENDING_SETUP: "Pending setup",
  ACTIVE: "Active",
  SUSPENDED: "Suspended",
  DISABLED: "Disabled",
};

export function UserStatusBadge({ status }: { status: UserStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}
