"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import type { FormDefinitionV1 } from "@/lib/registration-form-definition";
import { fieldsForSection, sortSections } from "@/lib/registration-form-definition";
import type { PublicRegistrationFieldRules } from "@/lib/public-registration";
import { RegistrantEditFieldGroup } from "@/app/register/lookup/edit/registrant-edit-field-input";
import { updateSubmissionFormEntries } from "../../../actions";

type ChildRow = {
  registrationId: string;
  values: Record<string, string>;
};

type Props = {
  submissionId: string;
  definition: FormDefinitionV1;
  rules: PublicRegistrationFieldRules;
  guardianValues: Record<string, string>;
  children: ChildRow[];
};

export function AdminFormEntriesEdit(p: Props) {
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
    <form
      className="space-y-6 rounded-xl border border-foreground/10 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setMessage(null);
        startTransition(async () => {
          const r = await updateSubmissionFormEntries(p.submissionId, fd);
          setOk(r.ok);
          setMessage(r.message);
          if (r.ok) router.refresh();
        });
      }}
    >
      <div>
        <h3 className="text-sm font-semibold">Registration form entries</h3>
        <p className="mt-1 text-xs text-foreground/70">
          Edit guardian and child answers using the same fields families see on the registration form.
        </p>
      </div>

      {message ? (
        <div
          className={
            ok
              ? "rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-900"
              : "rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-900"
          }
        >
          {message}
        </div>
      ) : null}

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
        <section key={section.id} className="space-y-4 border-t border-foreground/10 pt-4 first:border-t-0 first:pt-0">
          <div>
            <h4 className="text-sm font-semibold">{section.title}</h4>
            {section.description?.trim() ? (
              <p className="mt-1 text-xs text-foreground/70">{section.description}</p>
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
          <div key={row.registrationId} className="space-y-4 border-t border-foreground/10 pt-4">
            {childSections.map((section) => (
              <section key={`${row.registrationId}-${section.id}`} className="space-y-4">
                <div>
                  <h4 className="text-sm font-semibold">
                    {childName}
                    {dob ? <span className="font-normal text-foreground/60"> ({dob})</span> : null}
                  </h4>
                  {section.description?.trim() ? (
                    <p className="mt-1 text-xs text-foreground/70">{section.description}</p>
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

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save form entries"}
      </button>
    </form>
  );
}
