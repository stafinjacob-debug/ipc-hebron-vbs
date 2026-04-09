import { ContentSubNav } from "@/components/layout/content-sub-nav";

export default function ContentLayout({ children }: { children: React.ReactNode }) {
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
