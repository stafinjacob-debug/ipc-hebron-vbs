import { ContentSubNav } from "@/components/layout/content-sub-nav";
import { auth } from "@/auth";
import { canSeeMainNavLink } from "@/lib/permissions";
import { redirect } from "next/navigation";

export default async function ContentLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.role) redirect("/login");
  if (!canSeeMainNavLink(session.user.role, "/content/announcements")) {
    redirect("/dashboard");
  }

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Content</h1>
        <p className="mt-1 text-sm text-muted">
          Keep families and volunteers in the loop—announcements and shared files live here.
        </p>
        <ContentSubNav />
      </header>
      {children}
    </div>
  );
}
