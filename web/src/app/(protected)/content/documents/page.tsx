import { auth } from "@/auth";
import { FileStack } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { canViewOperations } from "@/lib/roles";

export default async function ContentDocumentsPage() {
  const session = await auth();
  if (!session?.user?.role) redirect("/login");
  if (!canViewOperations(session.user.role)) redirect("/dashboard");

  return (
    <section className="space-y-4" aria-labelledby="documents-heading">
      <h2 id="documents-heading" className="sr-only">
        Documents
      </h2>
      <div className="rounded-2xl border border-dashed border-foreground/20 bg-surface-elevated px-6 py-12 text-center shadow-sm">
        <FileStack className="mx-auto size-12 text-brand/60" aria-hidden />
        <p className="mt-4 text-lg font-semibold text-foreground">No documents uploaded yet</p>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
          Schedules, waivers, and handouts will live here. Until uploads are available, add links in your public
          registration welcome text so families can grab what they need.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link
            href="/seasons"
            className="inline-flex rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-brand-foreground shadow-sm hover:opacity-90"
          >
            Open VBS seasons
          </Link>
          <Link
            href="/settings"
            className="inline-flex rounded-lg border border-foreground/15 px-4 py-2.5 text-sm font-medium hover:bg-foreground/[0.04]"
          >
            Settings
          </Link>
        </div>
      </div>
    </section>
  );
}
