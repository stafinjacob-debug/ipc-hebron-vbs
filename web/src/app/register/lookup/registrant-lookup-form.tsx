"use client";

import { useState, useTransition } from "react";
import {
  openRegistrantSubmissionAction,
  requestRegistrantLookupOtpAction,
  verifyRegistrantLookupOtpAction,
  type RegistrantLookupActionState,
} from "./actions";

type Step = "request" | "verify" | "pick";

export function RegistrantLookupForm() {
  const [step, setStep] = useState<Step>("request");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [ok, setOk] = useState<boolean | null>(null);
  const [email, setEmail] = useState("");
  const [registrationCode, setRegistrationCode] = useState("");
  const [pickList, setPickList] = useState<RegistrantLookupActionState["submissions"]>([]);

  function handleRequest(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setMessage(null);
    startTransition(async () => {
      const r = await requestRegistrantLookupOtpAction(fd);
      setOk(r.ok);
      setMessage(r.message);
      if (r.ok) {
        setEmail(String(fd.get("email") ?? ""));
        setRegistrationCode(String(fd.get("registrationCode") ?? ""));
        setStep("verify");
      }
    });
  }

  function handleVerify(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("email", email);
    if (registrationCode) fd.set("registrationCode", registrationCode);
    setMessage(null);
    startTransition(async () => {
      const r = await verifyRegistrantLookupOtpAction(fd);
      setOk(r.ok);
      setMessage(r.message);
      if (r.ok && r.step === "pick_submission" && r.submissions?.length) {
        setPickList(r.submissions);
        setStep("pick");
      }
    });
  }

  function openSubmission(item: NonNullable<RegistrantLookupActionState["submissions"]>[number]) {
    setMessage(null);
    startTransition(async () => {
      const r = await openRegistrantSubmissionAction(item.key, item.kind, email);
      setOk(r.ok);
      setMessage(r.message);
    });
  }

  return (
    <div className="space-y-4">
      {message ? (
        <div
          className={
            ok
              ? "rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-900"
              : "rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-900"
          }
        >
          {message}
        </div>
      ) : null}

      {step === "request" ? (
        <form onSubmit={handleRequest} className="space-y-4">
          <p className="text-sm text-foreground/75">
            Enter your registration reference code <em>or</em> just your email. We&apos;ll send a
            one-time code to the email on your registration.
          </p>
          <div>
            <label htmlFor="registrationCode" className="block text-sm font-medium">
              Registration code <span className="font-normal text-muted">(optional)</span>
            </label>
            <input
              id="registrationCode"
              name="registrationCode"
              placeholder="VBS-…"
              className="mt-1 w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm font-mono"
            />
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium">
              Email on registration
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="mt-1 w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-brand-foreground hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Sending…" : "Send verification code"}
          </button>
        </form>
      ) : null}

      {step === "verify" ? (
        <form onSubmit={handleVerify} className="space-y-4">
          <p className="text-sm text-foreground/75">
            Enter the 6-digit code sent to <strong>{email}</strong>.
          </p>
          <div>
            <label htmlFor="code" className="block text-sm font-medium">
              Verification code
            </label>
            <input
              id="code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
              className="mt-1 w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 text-center text-lg font-mono tracking-widest"
            />
          </div>
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-brand-foreground hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Verifying…" : "Verify & continue"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setStep("request")}
            className="w-full text-sm font-medium text-brand underline"
          >
            Start over
          </button>
        </form>
      ) : null}

      {step === "pick" && pickList?.length ? (
        <div className="space-y-3">
          <p className="text-sm text-foreground/75">Multiple registrations found. Choose one to open:</p>
          <ul className="space-y-2">
            {pickList.map((s) => (
              <li key={`${s.kind}:${s.key}`}>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => openSubmission(s)}
                  className="w-full rounded-lg border border-foreground/15 px-4 py-3 text-left hover:bg-foreground/[0.03] disabled:opacity-50"
                >
                  <p className="font-medium">{s.seasonName}</p>
                  <p className="text-sm text-muted">{s.childNames || "Registration on file"}</p>
                  {s.registrationNumbers ? (
                    <p className="mt-1 text-xs text-muted">Reg # {s.registrationNumbers}</p>
                  ) : null}
                  <p className="mt-1 font-mono text-xs text-muted">{s.registrationCode}</p>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
