import Link from "next/link";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight">IPC Hebron VBS</h1>
          <p className="mt-1 text-sm text-foreground/70">Sign in to continue</p>
          <p className="mt-3 text-sm">
            <Link href="/register" className="font-medium text-foreground underline hover:no-underline">
              Register a child for VBS
            </Link>
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
