"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveRegistrantSubmissionAction, signOutRegistrantLookupAction } from "../actions";

type ChildRow = {
  registrationId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  allergiesNotes: string | null;
  customResponsesJson: string;
};

type Props = {
  registrationCode: string;
  seasonName: string;
  guardian: {
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
  };
  guardianResponsesJson: string;
  children: ChildRow[];
};

export function RegistrantEditForm(p: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [ok, setOk] = useState<boolean | null>(null);

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-foreground/10 bg-foreground/[0.02] px-4 py-3 text-sm">
        <p className="font-medium">{p.seasonName}</p>
        <p className="mt-1 font-mono text-xs text-muted">Reference {p.registrationCode}</p>
      </div>

      {message ? (
        <div
          className={
            ok
              ? "rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm"
              : "rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm"
          }
        >
          {message}
        </div>
      ) : null}

      <form
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          setMessage(null);
          startTransition(async () => {
            const r = await saveRegistrantSubmissionAction(fd);
            setOk(r.ok);
            setMessage(r.message);
            if (r.ok) router.refresh();
          });
        }}
      >
        <section className="space-y-3 rounded-xl border border-foreground/10 p-4">
          <h2 className="text-sm font-semibold">Parent / guardian</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs text-muted">First name</label>
              <input
                name="g_first"
                required
                defaultValue={p.guardian.firstName}
                className="mt-1 w-full rounded-md border border-foreground/15 px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted">Last name</label>
              <input
                name="g_last"
                required
                defaultValue={p.guardian.lastName}
                className="mt-1 w-full rounded-md border border-foreground/15 px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted">Email</label>
              <input
                name="g_email"
                type="email"
                defaultValue={p.guardian.email ?? ""}
                className="mt-1 w-full rounded-md border border-foreground/15 px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted">Phone</label>
              <input
                name="g_phone"
                defaultValue={p.guardian.phone ?? ""}
                className="mt-1 w-full rounded-md border border-foreground/15 px-2 py-1.5 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted">Additional guardian answers (JSON)</label>
            <textarea
              name="g_json"
              rows={5}
              defaultValue={p.guardianResponsesJson}
              className="mt-1 w-full rounded-md border border-foreground/15 px-2 py-1.5 font-mono text-xs"
            />
          </div>
        </section>

        {p.children.map((c) => (
          <section key={c.registrationId} className="space-y-3 rounded-xl border border-foreground/10 p-4">
            <h2 className="text-sm font-semibold">
              {c.firstName} {c.lastName}{" "}
              <span className="font-normal text-muted">({c.dateOfBirth})</span>
            </h2>
            <div>
              <label className="text-xs text-muted">Allergies / medical notes</label>
              <textarea
                name={`allergies_${c.registrationId}`}
                rows={2}
                defaultValue={c.allergiesNotes ?? ""}
                className="mt-1 w-full rounded-md border border-foreground/15 px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted">Additional child answers (JSON)</label>
              <textarea
                name={`child_json_${c.registrationId}`}
                rows={5}
                defaultValue={c.customResponsesJson}
                className="mt-1 w-full rounded-md border border-foreground/15 px-2 py-1.5 font-mono text-xs"
              />
            </div>
          </section>
        ))}

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-foreground hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save changes"}
          </button>
          <button
            type="button"
            disabled={pending}
            className="rounded-lg border border-foreground/15 px-4 py-2 text-sm font-medium hover:bg-foreground/5"
            onClick={() => {
              startTransition(async () => {
                await signOutRegistrantLookupAction();
                router.push("/register/lookup");
                router.refresh();
              });
            }}
          >
            Sign out
          </button>
        </div>
      </form>
    </div>
  );
}
