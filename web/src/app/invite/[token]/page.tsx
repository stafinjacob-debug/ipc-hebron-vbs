import Link from "next/link";
import { InviteAcceptForm } from "./invite-accept-form";

export const metadata = {
  title: "Accept invitation | IPC Hebron VBS",
};

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!token || token.length < 16) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-foreground/80">This invitation link is not valid.</p>
        <Link href="/login" className="mt-4 inline-block text-sm font-medium text-brand underline">
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-center text-2xl font-semibold text-foreground">Accept your invitation</h1>
      <p className="mt-2 text-center text-sm text-foreground/70">
        Choose a password to finish setting up your IPC Hebron VBS staff account.
      </p>
      <div className="mt-8 rounded-xl border border-foreground/10 bg-surface-elevated p-6 shadow-sm">
        <InviteAcceptForm token={token} />
      </div>
      <p className="mt-6 text-center text-xs text-foreground/55">
        Already set up?{" "}
        <Link href="/login" className="font-medium text-brand underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
