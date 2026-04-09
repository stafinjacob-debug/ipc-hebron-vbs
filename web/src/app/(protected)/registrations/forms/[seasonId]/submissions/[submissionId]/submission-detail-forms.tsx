"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  bulkCancelSubmission,
  bulkMoveSubmissionToWaitlist,
  resendRegistrationConfirmation,
  updateSubmissionGuardianAndResponses,
  updateSubmissionRegistrations,
} from "../../../actions";

const STATUSES = ["PENDING", "CONFIRMED", "WAITLIST", "CANCELLED", "CHECKED_OUT", "DRAFT"] as const;

export function SubmissionDetailForms({
  seasonId,
  submissionId,
  canEdit,
  guardian,
  responsesJson,
  registrations,
}: {
  seasonId: string;
  submissionId: string;
  canEdit: boolean;
  guardian: {
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
  };
  responsesJson: string;
  registrations: Array<{
    id: string;
    registrationNumber: string | null;
    status: string;
    notes: string | null;
    child: {
      firstName: string;
      lastName: string;
      dateOfBirth: string;
      allergiesNotes: string | null;
    };
  }>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  if (!canEdit) {
    return (
      <div className="space-y-4 text-sm">
        <div className="rounded-xl border border-foreground/10 p-4">
          <p className="font-semibold">Guardian</p>
          <p className="mt-1">
            {guardian.firstName} {guardian.lastName}
          </p>
          <p className="text-foreground/70">{guardian.email ?? "—"}</p>
          <p className="text-foreground/70">{guardian.phone ?? "—"}</p>
        </div>
        <div className="rounded-xl border border-foreground/10 p-4">
          <p className="font-semibold">Extra responses (JSON)</p>
          <pre className="mt-2 max-h-48 overflow-auto rounded bg-foreground/[0.04] p-2 text-xs">
            {responsesJson}
          </pre>
        </div>
        {registrations.map((r) => (
          <div key={r.id} className="rounded-xl border border-foreground/10 p-4">
            <p className="font-semibold">
              {r.child.firstName} {r.child.lastName}
            </p>
            <p className="mt-1 font-mono text-sm text-foreground/80">
              Reg # {r.registrationNumber ?? "Pending approval"}
            </p>
            <p className="text-foreground/70">DOB {r.child.dateOfBirth}</p>
            <p className="text-foreground/70">Status: {r.status}</p>
            <Link
              href={`/registrations/${r.id}`}
              className="mt-2 inline-block text-sm font-medium text-brand underline"
            >
              View registration & actions
            </Link>
            {r.child.allergiesNotes ? (
              <p className="mt-2 text-sm text-foreground/80">Medical notes on file (staff only).</p>
            ) : null}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          className="rounded-md border border-foreground/20 px-3 py-2 text-sm font-medium hover:bg-foreground/[0.04] disabled:opacity-50"
          onClick={() => {
            setMsg(null);
            startTransition(async () => {
              const r = await bulkMoveSubmissionToWaitlist(submissionId);
              setMsg(r.message);
              if (r.ok) router.refresh();
            });
          }}
        >
          Waitlist all
        </button>
        <button
          type="button"
          disabled={pending}
          className="rounded-md border border-red-500/30 px-3 py-2 text-sm font-medium text-red-700 disabled:opacity-50 dark:text-red-300"
          onClick={() => {
            if (!confirm("Cancel all registrations on this submission?")) return;
            setMsg(null);
            startTransition(async () => {
              const r = await bulkCancelSubmission(submissionId);
              setMsg(r.message);
              if (r.ok) router.refresh();
            });
          }}
        >
          Cancel all
        </button>
        <button
          type="button"
          disabled={pending}
          className="rounded-md border border-foreground/20 px-3 py-2 text-sm font-medium hover:bg-foreground/[0.04] disabled:opacity-50"
          onClick={() => {
            setMsg(null);
            startTransition(async () => {
              const r = await resendRegistrationConfirmation(submissionId);
              setMsg(r.message);
            });
          }}
        >
          Resend confirmation
        </button>
      </div>

      <form
        className="space-y-4 rounded-xl border border-foreground/10 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          setMsg(null);
          startTransition(async () => {
            const r = await updateSubmissionGuardianAndResponses(submissionId, {
              firstName: String(fd.get("g_first") ?? ""),
              lastName: String(fd.get("g_last") ?? ""),
              email: String(fd.get("g_email") ?? "").trim() || null,
              phone: String(fd.get("g_phone") ?? "").trim() || null,
              guardianResponsesJson: String(fd.get("g_json") ?? ""),
            });
            setMsg(r.message);
            if (r.ok) router.refresh();
          });
        }}
      >
        <h3 className="text-sm font-semibold">Guardian & extra responses</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs text-foreground/70">First name</label>
            <input
              name="g_first"
              required
              defaultValue={guardian.firstName}
              className="mt-1 w-full rounded-md border border-foreground/15 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-foreground/70">Last name</label>
            <input
              name="g_last"
              required
              defaultValue={guardian.lastName}
              className="mt-1 w-full rounded-md border border-foreground/15 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-foreground/70">Email</label>
            <input
              name="g_email"
              type="email"
              defaultValue={guardian.email ?? ""}
              className="mt-1 w-full rounded-md border border-foreground/15 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-foreground/70">Phone</label>
            <input
              name="g_phone"
              defaultValue={guardian.phone ?? ""}
              className="mt-1 w-full rounded-md border border-foreground/15 px-2 py-1.5 text-sm"
            />
          </div>
        </div>
        <div>
          <label className="text-xs text-foreground/70">Custom guardian responses (JSON object)</label>
          <textarea
            name="g_json"
            rows={6}
            defaultValue={responsesJson}
            className="mt-1 w-full rounded-md border border-foreground/15 px-2 py-1.5 font-mono text-xs"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-50"
        >
          Save guardian / JSON
        </button>
      </form>

      <form
        className="space-y-4 rounded-xl border border-foreground/10 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const updates = registrations.map((r) => ({
            registrationId: r.id,
            status: String(fd.get(`status_${r.id}`) ?? "") || undefined,
            notes: String(fd.get(`notes_${r.id}`) ?? "") || null,
          }));
          setMsg(null);
          startTransition(async () => {
            const r = await updateSubmissionRegistrations(submissionId, updates);
            setMsg(r.message);
            if (r.ok) router.refresh();
          });
        }}
      >
        <h3 className="text-sm font-semibold">Per-child registrations</h3>
        {registrations.map((r) => (
          <div key={r.id} className="border-t border-foreground/10 pt-4 first:border-t-0 first:pt-0">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-medium">
                {r.child.firstName} {r.child.lastName}{" "}
                <span className="text-foreground/60">({r.child.dateOfBirth})</span>
              </p>
              <Link href={`/registrations/${r.id}`} className="text-sm font-medium text-brand underline">
                View · {r.registrationNumber ?? "Pending approval"}
              </Link>
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <div>
                <label className="text-xs text-foreground/70">Status</label>
                <select
                  name={`status_${r.id}`}
                  defaultValue={r.status}
                  className="mt-1 w-full rounded-md border border-foreground/15 px-2 py-1.5 text-sm"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs text-foreground/70">Staff notes</label>
                <textarea
                  name={`notes_${r.id}`}
                  rows={2}
                  defaultValue={r.notes ?? ""}
                  className="mt-1 w-full rounded-md border border-foreground/15 px-2 py-1.5 text-sm"
                />
              </div>
            </div>
          </div>
        ))}
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-50"
        >
          Save registration rows
        </button>
      </form>

      {msg ? <p className="text-sm text-foreground/80">{msg}</p> : null}
    </div>
  );
}
