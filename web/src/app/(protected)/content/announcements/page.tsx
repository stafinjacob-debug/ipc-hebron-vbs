import { auth } from "@/auth";
import { Megaphone } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { canViewOperations } from "@/lib/roles";

export default async function ContentAnnouncementsPage() {
  const session = await auth();
  if (!session?.user?.role) redirect("/login");
  if (!canViewOperations(session.user.role)) redirect("/dashboard");

  return (
    <section className="space-y-4" aria-labelledby="announcements-heading">
      <h2 id="announcements-heading" className="sr-only">
        Announcements
      </h2>
      <div className="rounded-2xl border border-dashed border-brand/35 bg-gradient-to-b from-brand-muted/40 to-transparent px-6 py-12 text-center dark:from-brand-muted/15 dark:to-transparent">
        <Megaphone className="mx-auto size-12 text-brand/70" aria-hidden />
        <p className="mt-4 text-lg font-semibold text-foreground">No announcements yet</p>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
          Keep parents in the loop with updates, reminders, and schedule changes. In-app posting is on the way—for now,
          share through email or your bulletin and link details from the public registration welcome message.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link
            href="/seasons"
            className="inline-flex rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-brand-foreground shadow-sm hover:opacity-90"
          >
            Add details in welcome message
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex rounded-lg border border-foreground/15 px-4 py-2.5 text-sm font-medium hover:bg-foreground/[0.04]"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    </section>
  );
}
