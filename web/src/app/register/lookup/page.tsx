import Link from "next/link";
import { RegistrantLookupForm } from "./registrant-lookup-form";

export default function RegistrantLookupPage() {
  return (
    <div className="mx-auto max-w-md space-y-6 px-4 py-10">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Find your registration</h1>
        <p className="mt-2 text-sm text-muted">
          View or update your VBS registration using your registration number, email, or phone. We&apos;ll
          verify your identity with a code sent to the email on file.
        </p>
      </div>

      <div className="rounded-xl border border-foreground/10 bg-surface-elevated p-6 shadow-sm">
        <RegistrantLookupForm />
      </div>

      <p className="text-center text-sm text-muted">
        <Link href="/register" className="font-medium text-brand underline">
          Register for VBS
        </Link>
        {" · "}
        <Link href="/login" className="font-medium text-brand underline">
          Staff login
        </Link>
      </p>
    </div>
  );
}
