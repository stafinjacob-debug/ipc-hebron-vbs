"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import type { FormDefinitionV1 } from "@/lib/registration-form-definition";
import { fieldsForSection, sortSections } from "@/lib/registration-form-definition";
import type { PublicRegistrationFieldRules } from "@/lib/public-registration";
import type { RegistrantPaymentDisplay } from "@/lib/registrant-lookup-payment";
import { saveRegistrantSubmissionAction, signOutRegistrantLookupAction } from "../actions";
import { RegistrantEditFieldGroup } from "./registrant-edit-field-input";
import { RegistrantPaymentSection } from "./registrant-payment-section";

type ChildRow = {
  registrationId: string;
  values: Record<string, string>;
};

type Props = {
  registrationCode: string;
  seasonName: string;
  definition: FormDefinitionV1;
  rules: PublicRegistrationFieldRules;
  payment: RegistrantPaymentDisplay;
  paymentCanceled?: boolean;
  paymentDeadlineNotice: string;
  guardianValues: Record<string, string>;
  children: ChildRow[];
};

export function RegistrantEditForm(p: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [ok, setOk] = useState<boolean | null>(null);
  const [guardianValues, setGuardianValues] = useState(p.guardianValues);
  const [childRows, setChildRows] = useState(p.children);

  const guardianSections = useMemo(
    () => sortSections(p.definition).filter((s) => s.audience === "guardian" || s.audience === "consent"),
    [p.definition],
  );
  const childSections = useMemo(
    () => sortSections(p.definition).filter((s) => s.audience === "eachChild"),
    [p.definition],
  );

  function updateChildValues(registrationId: string, key: string, value: string) {
    setChildRows((rows) =>
      rows.map((row) =>
        row.registrationId === registrationId
          ? { ...row, values: { ...row.values, [key]: value } }
          : row,
      ),
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-foreground/10 bg-foreground/[0.02] px-4 py-3 text-sm">
        <p className="font-medium">{p.seasonName}</p>
        <p className="mt-1 font-mono text-xs text-muted">Reference {p.registrationCode}</p>
      </div>

      <RegistrantPaymentSection
        payment={p.payment}
        paymentCanceled={p.paymentCanceled}
        paymentDeadlineNotice={p.paymentDeadlineNotice}
      />

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
        {childRows.map((row) => (
          <input
            key={`reg-id-${row.registrationId}`}
            type="hidden"
            name="registrationIds"
            value={row.registrationId}
            readOnly
          />
        ))}

        {guardianSections.map((section) => (
          <section key={section.id} className="space-y-4 rounded-xl border border-foreground/10 p-4">
            <div>
              <h2 className="text-sm font-semibold">{section.title}</h2>
              {section.description?.trim() ? (
                <p className="mt-1 text-xs text-muted">{section.description}</p>
              ) : null}
            </div>
            <RegistrantEditFieldGroup
              fields={fieldsForSection(p.definition, section.id)}
              values={guardianValues}
              onChange={(key, value) => setGuardianValues((prev) => ({ ...prev, [key]: value }))}
              rules={p.rules}
            />
          </section>
        ))}

        {childRows.map((row) => {
          const childName =
            `${row.values.childFirstName ?? ""} ${row.values.childLastName ?? ""}`.trim() || "Child";
          const dob = row.values.childDateOfBirth?.trim();
          return (
            <div key={row.registrationId} className="space-y-4">
              {childSections.map((section) => (
                <section
                  key={`${row.registrationId}-${section.id}`}
                  className="space-y-4 rounded-xl border border-foreground/10 p-4"
                >
                  <div>
                    <h2 className="text-sm font-semibold">
                      {childName}
                      {dob ? <span className="font-normal text-muted"> ({dob})</span> : null}
                    </h2>
                    {section.description?.trim() ? (
                      <p className="mt-1 text-xs text-muted">{section.description}</p>
                    ) : null}
                  </div>
                  <RegistrantEditFieldGroup
                    fields={fieldsForSection(p.definition, section.id)}
                    values={row.values}
                    onChange={(key, value) => updateChildValues(row.registrationId, key, value)}
                    rules={p.rules}
                    registrationId={row.registrationId}
                  />
                </section>
              ))}
            </div>
          );
        })}

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
