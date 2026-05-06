"use client";

import { useCallback, useState } from "react";
import {
  completePasswordResetWithOtpAction,
  requestPasswordResetOtpAction,
} from "@/app/login/password-reset-actions";

export function StaffPasswordResetForm() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"request" | "verify" | "done">("request");
  const [resetEmail, setResetEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [banner, setBanner] = useState<{ ok: boolean; message: string } | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    setStep("request");
    setResetEmail("");
    setBanner(null);
    setPending(false);
  }, []);

  const onRequestSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBanner(null);
    setPending(true);
    try {
      const fd = new FormData(e.currentTarget);
      const r = await requestPasswordResetOtpAction(fd);
      if (r.ok) {
        const em = String(fd.get("email") ?? "")
          .trim()
          .toLowerCase();
        setResetEmail(em);
        setStep("verify");
        setBanner(null);
      } else {
        setBanner({ ok: false, message: r.message });
      }
    } finally {
      setPending(false);
    }
  }, []);

  const onCompleteSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBanner(null);
    setPending(true);
    try {
      const fd = new FormData(e.currentTarget);
      fd.set("email", resetEmail);
      const r = await completePasswordResetWithOtpAction(fd);
      if (r.ok) {
        setBanner({ ok: true, message: r.message });
        setStep("done");
      } else {
        setBanner({ ok: false, message: r.message });
      }
    } finally {
      setPending(false);
    }
  }, [resetEmail]);

  return (
    <div className="mt-4 border-t border-stone-200/80 pt-4">
      {!open ? (
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setStep("request");
            setResetEmail("");
            setBanner(null);
          }}
          className="w-full text-center text-sm font-medium text-teal-700 underline-offset-2 hover:underline"
        >
          Forgot password?
        </button>
      ) : (
        <div className="space-y-4 rounded-xl border border-stone-200/80 bg-white/50 p-4 dark:bg-white/45">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-stone-800">Reset password</p>
            <button type="button" onClick={close} className="text-xs text-stone-500 hover:text-stone-800">
              Close
            </button>
          </div>
          <p className="text-xs leading-relaxed text-stone-600">
            We email a one-time code to your staff inbox. Codes expire in 15 minutes. Parent accounts cannot use this
            flow — contact staff if you need help.
          </p>

          {banner && step === "request" ? (
            <p className={`text-xs ${banner.ok ? "text-emerald-800" : "text-red-600"}`}>{banner.message}</p>
          ) : null}

          {step === "done" && banner ? (
            <div className="space-y-3">
              <p className="text-sm text-emerald-800">{banner.message}</p>
              <button
                type="button"
                onClick={close}
                className="w-full rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:opacity-90"
              >
                Back to sign in
              </button>
            </div>
          ) : null}

          {step === "request" ? (
            <form onSubmit={onRequestSubmit} className="space-y-3">
              <div>
                <label htmlFor="reset-email" className="block text-xs font-medium text-stone-700">
                  Account email
                </label>
                <input
                  id="reset-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  defaultValue={resetEmail}
                  className="mt-1 w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 outline-none ring-brand/30 focus:ring-2"
                />
              </div>
              <button
                type="submit"
                disabled={pending}
                className="w-full rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-900 hover:bg-stone-50 disabled:opacity-50"
              >
                {pending ? "Sending…" : "Send code"}
              </button>
            </form>
          ) : step === "verify" ? (
            <form onSubmit={onCompleteSubmit} className="space-y-3">
              <p className="text-xs text-stone-600">
                Code sent to <span className="font-medium text-stone-800">{resetEmail}</span>
              </p>
              <div>
                <label htmlFor="reset-code" className="block text-xs font-medium text-stone-700">
                  6-digit code
                </label>
                <input
                  id="reset-code"
                  name="code"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  autoComplete="one-time-code"
                  required
                  placeholder="000000"
                  className="mt-1 w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm tracking-widest text-stone-900 outline-none ring-brand/30 focus:ring-2"
                />
              </div>
              <div>
                <label htmlFor="reset-new-password" className="block text-xs font-medium text-stone-700">
                  New password
                </label>
                <input
                  id="reset-new-password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  className="mt-1 w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 outline-none ring-brand/30 focus:ring-2"
                />
              </div>
              <div>
                <label htmlFor="reset-confirm" className="block text-xs font-medium text-stone-700">
                  Confirm new password
                </label>
                <input
                  id="reset-confirm"
                  name="confirm"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  className="mt-1 w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 outline-none ring-brand/30 focus:ring-2"
                />
              </div>
              {banner ? (
                <p className={`text-xs ${banner.ok ? "text-emerald-800" : "text-red-600"}`}>{banner.message}</p>
              ) : null}
              <div className="flex flex-col gap-2">
                <button
                  type="submit"
                  disabled={pending}
                  className="w-full rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-900 hover:bg-stone-50 disabled:opacity-50"
                >
                  {pending ? "Saving…" : "Update password"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStep("request");
                    setBanner(null);
                  }}
                  className="text-center text-xs text-stone-600 hover:text-stone-900"
                >
                  ← Send a new code
                </button>
              </div>
            </form>
          ) : null}
        </div>
      )}
    </div>
  );
}
