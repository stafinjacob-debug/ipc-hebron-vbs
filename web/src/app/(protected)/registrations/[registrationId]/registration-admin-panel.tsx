"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  approveRegistration,
  declineRegistration,
  deleteRegistrationRecord,
  markRegistrationPaymentReceived,
  sendCustomRegistrationSmsAction,
  sendRegistrationConfirmationSmsAction,
  resendPaymentReminderEmailAction,
  resendRegistrationConfirmationEmailAction,
  setRegistrationExpectsPayment,
} from "../registration-actions";

export function RegistrationAdminPanel({
  registrationId,
  status,
  expectsPayment,
  paymentReceivedAt,
  guardianHasEmail,
  guardianHasPhone,
}: {
  registrationId: string;
  status: string;
  expectsPayment: boolean;
  paymentReceivedAt: string | null;
  guardianHasEmail: boolean;
  guardianHasPhone: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [smsBody, setSmsBody] = useState("");

  const isConfirmed = status === "CONFIRMED";
  const canApprove = status === "PENDING" || status === "WAITLIST" || status === "DRAFT";
  const paymentOutstanding = expectsPayment && !paymentReceivedAt;

  return (
    <div className="space-y-4 rounded-xl border border-foreground/10 bg-surface-elevated p-5">
      <h3 className="text-sm font-semibold text-foreground">Admin actions</h3>
      {!guardianHasEmail ? (
        <p className="text-sm text-amber-800 dark:text-amber-200">
          Guardian has no email — confirmation and payment emails cannot be sent until an address is added (e.g. on the submission).
        </p>
      ) : null}
      {!guardianHasPhone ? (
        <p className="text-sm text-amber-800 dark:text-amber-200">
          Guardian has no SMS-capable phone value — SMS cannot be sent until a valid number is saved.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {canApprove ? (
          <button
            type="button"
            disabled={pending}
            className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            onClick={() => {
              setMsg(null);
              startTransition(async () => {
                const r = await approveRegistration(registrationId);
                setMsg(r.message);
                if (r.ok) router.refresh();
              });
            }}
          >
            Approve & notify
          </button>
        ) : null}
        {status !== "CANCELLED" && status !== "CHECKED_OUT" ? (
          <button
            type="button"
            disabled={pending}
            className="rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-800 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-200 dark:hover:bg-red-950/40"
            onClick={() => {
              if (!confirm("Decline this registration? It will be marked cancelled.")) return;
              setMsg(null);
              startTransition(async () => {
                const r = await declineRegistration(registrationId);
                setMsg(r.message);
                if (r.ok) router.refresh();
              });
            }}
          >
            Decline
          </button>
        ) : null}
        <button
          type="button"
          disabled={pending}
          className="rounded-lg border border-foreground/20 px-3 py-2 text-sm font-medium hover:bg-foreground/[0.04] disabled:opacity-50"
          onClick={() => {
            if (!confirm("Permanently delete this registration row? This cannot be undone.")) return;
            setMsg(null);
            startTransition(async () => {
              const r = await deleteRegistrationRecord(registrationId);
              setMsg(r.message);
              if (r.ok) router.push("/registrations");
            });
          }}
        >
          Delete registration
        </button>
      </div>

      <div className="border-t border-foreground/10 pt-4">
        <p className="text-xs font-medium text-foreground/60">Email</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending || !isConfirmed || !guardianHasEmail}
            className="rounded-lg border border-foreground/20 px-3 py-2 text-sm font-medium hover:bg-foreground/[0.04] disabled:opacity-40"
            title={!isConfirmed ? "Confirm this registration first" : undefined}
            onClick={() => {
              setMsg(null);
              startTransition(async () => {
                const r = await resendRegistrationConfirmationEmailAction(registrationId);
                setMsg(r.message);
              });
            }}
          >
            Resend confirmation + QR
          </button>
          <button
            type="button"
            disabled={pending || !paymentOutstanding || !guardianHasEmail}
            className="rounded-lg border border-foreground/20 px-3 py-2 text-sm font-medium hover:bg-foreground/[0.04] disabled:opacity-40"
            title={!expectsPayment ? 'Enable "expects payment" below first' : undefined}
            onClick={() => {
              setMsg(null);
              startTransition(async () => {
                const r = await resendPaymentReminderEmailAction(registrationId);
                setMsg(r.message);
              });
            }}
          >
            Resend payment reminder
          </button>
        </div>
      </div>

      <div className="border-t border-foreground/10 pt-4">
        <p className="text-xs font-medium text-foreground/60">Payment tracking</p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={expectsPayment}
              disabled={pending}
              onChange={(e) => {
                setMsg(null);
                startTransition(async () => {
                  const r = await setRegistrationExpectsPayment(registrationId, e.target.checked);
                  setMsg(r.message);
                  if (r.ok) router.refresh();
                });
              }}
            />
            Expects payment
          </label>
          {paymentReceivedAt ? (
            <span className="text-xs text-foreground/60">
              Paid {new Date(paymentReceivedAt).toLocaleString()}
            </span>
          ) : (
            <button
              type="button"
              disabled={pending || !expectsPayment}
              className="text-sm font-medium text-brand underline disabled:opacity-40"
              onClick={() => {
                setMsg(null);
                startTransition(async () => {
                  const r = await markRegistrationPaymentReceived(registrationId);
                  setMsg(r.message);
                  if (r.ok) router.refresh();
                });
              }}
            >
              Mark payment received
            </button>
          )}
        </div>
      </div>

      <div className="border-t border-foreground/10 pt-4">
        <p className="text-xs font-medium text-foreground/60">SMS (Twilio)</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending || !isConfirmed || !guardianHasPhone}
            className="rounded-lg border border-foreground/20 px-3 py-2 text-sm font-medium hover:bg-foreground/[0.04] disabled:opacity-40"
            title={!isConfirmed ? "Confirm this registration first" : undefined}
            onClick={() => {
              setMsg(null);
              startTransition(async () => {
                const r = await sendRegistrationConfirmationSmsAction(registrationId);
                setMsg(r.message);
              });
            }}
          >
            Send confirmation SMS
          </button>
        </div>
        <div className="mt-3 space-y-2">
          <label htmlFor="customSmsBody" className="text-xs text-foreground/60">
            Custom SMS message
          </label>
          <textarea
            id="customSmsBody"
            rows={3}
            value={smsBody}
            onChange={(e) => setSmsBody(e.target.value)}
            placeholder="Type a custom message to send to this guardian..."
            className="w-full rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={pending || !guardianHasPhone || !smsBody.trim()}
            className="rounded-lg border border-foreground/20 px-3 py-2 text-sm font-medium hover:bg-foreground/[0.04] disabled:opacity-40"
            onClick={() => {
              setMsg(null);
              startTransition(async () => {
                const r = await sendCustomRegistrationSmsAction(registrationId, smsBody);
                setMsg(r.message);
                if (r.ok) setSmsBody("");
              });
            }}
          >
            Send custom SMS
          </button>
        </div>
      </div>

      {msg ? <p className="text-sm text-foreground/80">{msg}</p> : null}
    </div>
  );
}
