"use client";

import { useState, useTransition } from "react";
import {
  resendEmbeddedApplicationEmailAction,
  saveEmbeddedRegistrarFieldsAction,
} from "../../../actions";

export function EmbeddedSubmissionAdminActions({
  submissionId,
  registrar,
  emailSentAt,
}: {
  submissionId: string;
  registrar: Record<string, string>;
  emailSentAt: string | null;
}) {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <a
          href={`/api/embedded-forms/submissions/${submissionId}/pdf`}
          className="rounded-md bg-brand px-3 py-2 text-sm font-semibold text-white"
        >
          Export filled PDF
        </a>
        <button
          type="button"
          disabled={pending}
          className="rounded-md border border-foreground/15 px-3 py-2 text-sm font-medium disabled:opacity-60"
          onClick={() =>
            startTransition(async () => {
              const r = await resendEmbeddedApplicationEmailAction(submissionId);
              setMsg(r.ok ? "Application-received email sent." : r.error);
            })
          }
        >
          Resend receipt email
        </button>
      </div>
      <p className="text-xs text-foreground/50">
        Receipt email: {emailSentAt ? `sent ${emailSentAt}` : "not sent yet"}
      </p>
      {msg ? <p className="text-sm text-foreground/70">{msg}</p> : null}

      <form
        className="space-y-3 rounded-xl border border-dashed border-indigo-300/60 bg-indigo-50/40 p-4 dark:bg-indigo-950/20"
        action={(fd) =>
          startTransition(async () => {
            const r = await saveEmbeddedRegistrarFieldsAction(submissionId, fd);
            setMsg(r.ok ? "Registrar fields saved." : r.error);
          })
        }
      >
        <h3 className="text-sm font-semibold text-indigo-800 dark:text-indigo-200">
          For registrar use only
        </h3>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block text-foreground/60">Date of receiving application</span>
            <input
              type="date"
              name="registrarDateReceived"
              defaultValue={registrar.registrarDateReceived ?? ""}
              className="w-full rounded-md border border-foreground/15 bg-transparent px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-foreground/60">Fees — application / late fee received ($)</span>
            <input
              name="registrarFeesReceived"
              defaultValue={registrar.registrarFeesReceived ?? ""}
              className="w-full rounded-md border border-foreground/15 bg-transparent px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-foreground/60">Application number</span>
            <input
              name="registrarApplicationNumber"
              defaultValue={registrar.registrarApplicationNumber ?? ""}
              placeholder="Defaults to system number on PDF"
              className="w-full rounded-md border border-foreground/15 bg-transparent px-3 py-2"
            />
          </label>
          <fieldset className="text-sm">
            <legend className="mb-1 text-foreground/60">Admission</legend>
            <div className="flex flex-wrap gap-3 pt-1">
              {["Approved", "Rejected", "Referred"].map((opt) => (
                <label key={opt} className="inline-flex items-center gap-1.5">
                  <input
                    type="radio"
                    name="registrarAdmissionDecision"
                    value={opt}
                    defaultChecked={registrar.registrarAdmissionDecision === opt}
                  />
                  {opt}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="block text-sm">
            <span className="mb-1 block text-foreground/60">Decision date</span>
            <input
              type="date"
              name="registrarDecisionDate"
              defaultValue={registrar.registrarDecisionDate ?? ""}
              className="w-full rounded-md border border-foreground/15 bg-transparent px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-foreground/60">Signature</span>
            <input
              name="registrarSignature"
              defaultValue={registrar.registrarSignature ?? ""}
              className="w-full rounded-md border border-foreground/15 bg-transparent px-3 py-2"
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-indigo-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          Save registrar fields
        </button>
      </form>
    </div>
  );
}
