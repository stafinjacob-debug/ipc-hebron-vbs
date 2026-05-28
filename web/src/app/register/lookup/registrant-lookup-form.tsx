"use client";

import { useState, useTransition } from "react";
import { formatPhoneInput, phoneDigits } from "@/lib/phone-format";
import type { RegistrantLookupEmailOption, RegistrantLookupMethod } from "@/lib/registrant-lookup";
import {
  openRegistrantSubmissionAction,
  requestRegistrantLookupOtpAction,
  verifyRegistrantLookupOtpAction,
  type RegistrantLookupActionState,
} from "./actions";

type Step = "request" | "pick_email" | "verify" | "pick";

const METHOD_LABELS: Record<RegistrantLookupMethod, string> = {
  registration_number: "Registration number",
  email: "Email address",
  phone: "Phone number",
};

export function RegistrantLookupForm() {
  const [step, setStep] = useState<Step>("request");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [ok, setOk] = useState<boolean | null>(null);
  const [lookupMethod, setLookupMethod] = useState<RegistrantLookupMethod>("email");
  const [email, setEmail] = useState("");
  const [registrationCode, setRegistrationCode] = useState("");
  const [phone, setPhone] = useState("");
  const [otpSentTo, setOtpSentTo] = useState("");
  const [emailOptions, setEmailOptions] = useState<RegistrantLookupEmailOption[]>([]);
  const [pickList, setPickList] = useState<RegistrantLookupActionState["submissions"]>([]);

  function resetFlow() {
    setStep("request");
    setMessage(null);
    setOk(null);
    setEmail("");
    setRegistrationCode("");
    setPhone("");
    setOtpSentTo("");
    setEmailOptions([]);
    setPickList([]);
  }

  function handleRequest(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("lookupMethod", lookupMethod);
    setMessage(null);
    startTransition(async () => {
      const r = await requestRegistrantLookupOtpAction(fd);
      setOk(r.ok);
      setMessage(r.message);
      if (!r.ok) return;

      if (r.step === "pick_email" && r.emailOptions?.length) {
        setEmailOptions(r.emailOptions);
        setPhone(String(fd.get("phone") ?? r.phone ?? ""));
        setLookupMethod("phone");
        setStep("pick_email");
        return;
      }

      if (r.step === "verify" && r.email) {
        setEmail(r.email);
        setOtpSentTo(r.otpSentTo ?? "");
        setRegistrationCode(r.registrationCode ?? "");
        setPhone(r.phone ?? "");
        setStep("verify");
      }
    });
  }

  function handlePickEmail(option: RegistrantLookupEmailOption) {
    setMessage(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("lookupMethod", "phone");
      fd.set("phone", phone);
      fd.set("selectedEmail", option.emailNormalized);
      const r = await requestRegistrantLookupOtpAction(fd);
      setOk(r.ok);
      setMessage(r.message);
      if (r.ok && r.step === "verify" && r.email) {
        setEmail(r.email);
        setOtpSentTo(r.otpSentTo ?? option.maskedEmail);
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
            Choose how you want to find your registration. We&apos;ll send a one-time verification code to
            the email on file.
          </p>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {(Object.keys(METHOD_LABELS) as RegistrantLookupMethod[]).map((method) => (
              <label
                key={method}
                className={`flex cursor-pointer items-center justify-center rounded-lg border px-3 py-2.5 text-center text-sm font-medium ${
                  lookupMethod === method
                    ? "border-brand bg-brand/10 text-brand"
                    : "border-foreground/15 hover:bg-foreground/[0.03]"
                }`}
              >
                <input
                  type="radio"
                  name="lookupMethodChoice"
                  value={method}
                  checked={lookupMethod === method}
                  onChange={() => setLookupMethod(method)}
                  className="sr-only"
                />
                {METHOD_LABELS[method]}
              </label>
            ))}
          </div>

          {lookupMethod === "registration_number" ? (
            <div>
              <label htmlFor="registrationCode" className="block text-sm font-medium">
                Registration number
              </label>
              <p className="mt-0.5 text-xs text-muted">
                Enter the registration or family reference number from your confirmation email or badge.
              </p>
              <input
                id="registrationCode"
                name="registrationCode"
                required
                value={registrationCode}
                onChange={(e) => setRegistrationCode(e.target.value)}
                placeholder="e.g. VBS-2026-001 or VBS-…"
                className="mt-1 w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm font-mono"
              />
            </div>
          ) : null}

          {lookupMethod === "email" ? (
            <div>
              <label htmlFor="email" className="block text-sm font-medium">
                Email address
              </label>
              <p className="mt-0.5 text-xs text-muted">Use the same email you entered when you registered.</p>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm"
              />
            </div>
          ) : null}

          {lookupMethod === "phone" ? (
            <div>
              <label htmlFor="phone" className="block text-sm font-medium">
                Phone number
              </label>
              <p className="mt-0.5 text-xs text-muted">
                Enter the phone number from your registration. We&apos;ll show matching email addresses on
                file so you can choose where to receive your verification code.
              </p>
              <input
                id="phone"
                name="phone"
                type="tel"
                required
                autoComplete="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
                placeholder="(555) 123-4567"
                className="mt-1 w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm"
              />
              {phoneDigits(phone).length > 0 && phoneDigits(phone).length < 10 ? (
                <p className="mt-1 text-xs text-muted">Enter all 10 digits.</p>
              ) : null}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-brand-foreground hover:opacity-90 disabled:opacity-50"
          >
            {pending
              ? lookupMethod === "phone"
                ? "Looking…"
                : "Sending…"
              : lookupMethod === "phone"
                ? "Find email addresses"
                : "Send verification code"}
          </button>
        </form>
      ) : null}

      {step === "pick_email" && emailOptions.length > 0 ? (
        <div className="space-y-3">
          <p className="text-sm text-foreground/75">
            {emailOptions.length === 1
              ? "This email is linked to your phone number on file. Send the verification code here:"
              : "These email addresses are linked to your phone number on registrations. Choose where to send your verification code:"}
          </p>
          <ul className="space-y-2">
            {emailOptions.map((opt) => (
              <li key={opt.emailNormalized}>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => handlePickEmail(opt)}
                  className="w-full rounded-lg border border-foreground/15 px-4 py-3 text-left hover:border-brand/40 hover:bg-brand/5 disabled:opacity-50"
                >
                  <p className="font-medium text-foreground">{opt.maskedEmail}</p>
                  {opt.childSummary ? (
                    <p className="mt-0.5 text-sm text-muted">Registrations: {opt.childSummary}</p>
                  ) : null}
                  <p className="mt-2 text-xs font-medium text-brand">
                    {pending ? "Sending code…" : "Send verification code to this email"}
                  </p>
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            disabled={pending}
            onClick={resetFlow}
            className="w-full text-sm font-medium text-brand underline"
          >
            Start over
          </button>
        </div>
      ) : null}

      {step === "verify" ? (
        <form onSubmit={handleVerify} className="space-y-4">
          <p className="text-sm text-foreground/75">
            Enter the 6-digit code sent to{" "}
            <strong>{otpSentTo || email}</strong>.
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
            onClick={resetFlow}
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
