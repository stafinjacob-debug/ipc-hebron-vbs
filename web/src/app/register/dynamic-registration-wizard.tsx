"use client";

import type React from "react";
import { useActionState, useCallback, useEffect, useMemo, useState } from "react";
import {
  Baby,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Heart,
  Lock,
  Plus,
  Shield,
  Sparkles,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import {
  defaultPublicFieldRules,
  type PublicRegistrationFieldRules,
} from "@/lib/public-registration";
import type { FormDefinitionV1, FormFieldDef } from "@/lib/registration-form-definition";
import { sortSections } from "@/lib/registration-form-definition";
import { formatPhoneInput, phoneDigits } from "@/lib/phone-format";
import { submitPublicRegistration, type PublicRegisterState } from "./actions";

export type PublicSeasonOption = {
  id: string;
  name: string;
  year: number;
  startDate: string;
  endDate: string;
  welcomeMessage: string | null;
  backgroundImageUrl: string | null;
  rules: PublicRegistrationFieldRules;
  formTitle: string;
  definition: FormDefinitionV1;
};

export type RegisterContactProps = {
  contactEmail: string;
  contactPhone: string;
  churchDisplayName: string;
};

const STEP_LABELS = ["Your information", "Children", "Privacy", "Review"] as const;
const TOTAL_STEPS = STEP_LABELS.length;
const initial: PublicRegisterState | null = null;

function hasFieldErrors(s: PublicRegisterState | null): boolean {
  return !!s?.fieldErrors && Object.keys(s.fieldErrors).length > 0;
}

function newChildId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `c-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function emailLooksValid(v: string): boolean {
  if (!v.trim()) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

function visible(field: FormFieldDef, ctx: Record<string, string>): boolean {
  if (!field.showWhen) return true;
  return (ctx[field.showWhen.fieldKey] ?? "") === field.showWhen.equals;
}

const labelClass = "block text-sm font-semibold text-neutral-900 dark:text-neutral-100";
const hintClass = "mt-1 text-xs text-neutral-500 dark:text-neutral-400";
const inputClass =
  "mt-1.5 w-full min-h-11 rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 text-base text-neutral-900 shadow-sm placeholder:text-neutral-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder:text-neutral-500";
const sectionCard =
  "rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm dark:border-neutral-700 dark:bg-neutral-950 sm:p-6";

function SectionHeader({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-5 flex gap-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-muted/80 text-brand dark:bg-brand-muted/30">
        <Icon className="size-5" aria-hidden />
      </span>
      <div>
        <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-50">{title}</h2>
        <p className="mt-0.5 text-sm text-neutral-600 dark:text-neutral-400">{description}</p>
      </div>
    </div>
  );
}

function renderFieldInput(
  field: FormFieldDef,
  value: string,
  onChange: (v: string) => void,
  rules: PublicRegistrationFieldRules,
  opts?: { onBlur?: () => void },
) {
  if (field.type === "sectionHeader") {
    return <h3 className="mt-4 text-base font-bold text-neutral-900 dark:text-neutral-50">{field.label}</h3>;
  }
  if (field.type === "staticText") {
    return (
      <div className="mt-2 rounded-lg bg-neutral-100 px-3 py-2 text-sm text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
        {field.helperText || field.label}
      </div>
    );
  }

  const req =
    field.required ||
    (field.key === "guardianEmail" && rules.requireGuardianEmail) ||
    (field.key === "guardianPhone" && rules.requireGuardianPhone);

  const inputId = `fld-${field.id}`;

  const commonLabel = (
    <label htmlFor={inputId} className={labelClass}>
      {field.label}
      {req ? <span className="text-red-600"> *</span> : <span className="font-normal text-neutral-500"> (optional)</span>}
    </label>
  );

  if (field.type === "textarea") {
    return (
      <div>
        {commonLabel}
        <textarea
          id={inputId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          placeholder={field.placeholder}
          className={inputClass}
        />
        {field.helperText ? <p className={hintClass}>{field.helperText}</p> : null}
      </div>
    );
  }

  if (field.type === "select" && field.options?.length) {
    return (
      <div>
        {commonLabel}
        <select
          id={inputId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        >
          <option value="">Choose…</option>
          {field.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {field.helperText ? <p className={hintClass}>{field.helperText}</p> : null}
      </div>
    );
  }

  if (field.type === "radio" && field.options?.length) {
    return (
      <fieldset>
        <legend className={labelClass}>{field.label}</legend>
        <div className="mt-2 space-y-2">
          {field.options.map((o) => (
            <label key={o.value} className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="radio"
                value={o.value}
                checked={value === o.value}
                onChange={() => onChange(o.value)}
                className="size-4 accent-brand"
              />
              {o.label}
            </label>
          ))}
        </div>
        {field.helperText ? <p className={hintClass}>{field.helperText}</p> : null}
      </fieldset>
    );
  }

  if (field.type === "checkbox") {
    return (
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={value === "true"}
          onChange={(e) => onChange(e.target.checked ? "true" : "")}
          className="mt-1 size-5 accent-brand"
        />
        <span>
          <span className="font-semibold text-neutral-900 dark:text-neutral-100">{field.label}</span>
          {field.helperText ? <span className="mt-1 block text-sm text-neutral-600">{field.helperText}</span> : null}
        </span>
      </label>
    );
  }

  if (field.type === "boolean") {
    return (
      <label className="flex cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          checked={value === "true"}
          onChange={(e) => onChange(e.target.checked ? "true" : "")}
          className="size-5 accent-brand"
        />
        <span className="text-sm font-medium">{field.label}</span>
      </label>
    );
  }

  const inputType =
    field.type === "email"
      ? "email"
      : field.type === "tel"
        ? "tel"
        : field.type === "date"
          ? "date"
          : field.type === "number"
            ? "number"
            : "text";

  const handleChange =
    field.key === "guardianPhone"
      ? (e: React.ChangeEvent<HTMLInputElement>) => onChange(formatPhoneInput(e.target.value))
      : (e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value);

  return (
    <div>
      {commonLabel}
      <input
        id={inputId}
        type={inputType}
        value={value}
        onChange={handleChange}
        onBlur={opts?.onBlur}
        placeholder={field.placeholder}
        inputMode={field.type === "tel" ? "numeric" : undefined}
        autoComplete={
          field.key === "guardianEmail"
            ? "email"
            : field.key === "guardianPhone"
              ? "tel"
              : field.key === "guardianFirstName"
                ? "given-name"
                : field.key === "guardianLastName"
                  ? "family-name"
                  : "off"
        }
        className={inputClass}
      />
      {field.helperText ? <p className={hintClass}>{field.helperText}</p> : null}
    </div>
  );
}

export function DynamicRegistrationWizard({
  seasons,
  clientSubmitKey,
  contactEmail,
  contactPhone,
  churchDisplayName,
}: {
  seasons: PublicSeasonOption[];
  /** Per page load — must match server action `submitPublicRegistration` idempotency check. */
  clientSubmitKey: string;
} & RegisterContactProps) {
  const [state, formAction, pending] = useActionState(submitPublicRegistration, initial);
  const [seasonId, setSeasonId] = useState(seasons[0]?.id ?? "");
  const [step, setStep] = useState(0);
  const [guardian, setGuardian] = useState<Record<string, string>>({});
  const [children, setChildren] = useState<Array<{ id: string; values: Record<string, string> }>>([]);
  const [confirmAccurate, setConfirmAccurate] = useState(false);
  const [emailBlurred, setEmailBlurred] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const current = useMemo(() => seasons.find((s) => s.id === seasonId), [seasons, seasonId]);
  const def = current?.definition;
  const rules = current?.rules ?? defaultPublicFieldRules;

  const guardianSections = useMemo(() => {
    if (!def) return [];
    return sortSections(def).filter((s) => s.audience === "guardian");
  }, [def]);

  const childSections = useMemo(() => {
    if (!def) return [];
    return sortSections(def).filter((s) => s.audience === "eachChild");
  }, [def]);

  const consentSections = useMemo(() => {
    if (!def) return [];
    return sortSections(def).filter((s) => s.audience === "consent" || s.audience === "static");
  }, [def]);

  const childFieldKeys = useMemo(() => {
    if (!def) return [] as string[];
    const ids = new Set(childSections.map((s) => s.id));
    return def.fields
      .filter((f) => ids.has(f.sectionId) && f.type !== "sectionHeader" && f.type !== "staticText")
      .map((f) => f.key);
  }, [def, childSections]);

  useEffect(() => {
    if (!def) return;
    const g: Record<string, string> = {};
    for (const f of def.fields) {
      const sec = def.sections.find((s) => s.id === f.sectionId);
      if (sec?.audience !== "guardian" && sec?.audience !== "consent") continue;
      if (f.type === "sectionHeader" || f.type === "staticText") continue;
      g[f.key] = f.defaultValue ?? "";
    }
    setGuardian(g);
    setChildren([{ id: newChildId(), values: Object.fromEntries(childFieldKeys.map((k) => [k, ""])) }]);
    setStep(0);
    setConfirmAccurate(false);
    setLocalError(null);
    setEmailBlurred(false);
  }, [seasonId, def, childFieldKeys]);

  const formatEventRange = useCallback((startIso: string, endIso: string) => {
    const start = new Date(startIso);
    const end = new Date(endIso);
    const o = { month: "long" as const, day: "numeric" as const, year: "numeric" as const };
    return `${start.toLocaleDateString(undefined, o)} – ${end.toLocaleDateString(undefined, o)}`;
  }, []);

  const validateStep = useCallback(
    (s: number): string | null => {
      if (!def) return "Form not loaded.";
      if (s === 0) {
        for (const sec of guardianSections) {
          for (const f of def.fields.filter((x) => x.sectionId === sec.id)) {
            if (f.type === "sectionHeader" || f.type === "staticText") continue;
            if (!visible(f, guardian)) continue;
            const v = guardian[f.key] ?? "";
            const req =
              f.required ||
              (f.key === "guardianEmail" && rules.requireGuardianEmail) ||
              (f.key === "guardianPhone" && rules.requireGuardianPhone);
            if (req && (f.type === "checkbox" || f.type === "boolean") && v !== "true") {
              return `${f.label} is required.`;
            }
            if (req && f.type !== "checkbox" && f.type !== "boolean" && !v.trim()) {
              return `${f.label} is required.`;
            }
            if (f.key === "guardianEmail" && v.trim() && !emailLooksValid(v)) {
              return "Please enter a valid email address.";
            }
            if (f.key === "guardianPhone" && rules.requireGuardianPhone && !phoneDigits(v)) {
              return "Phone is required.";
            }
          }
        }
      }
      if (s === 1) {
        for (let i = 0; i < children.length; i++) {
          const row = children[i].values;
          for (const sec of childSections) {
            for (const f of def.fields.filter((x) => x.sectionId === sec.id)) {
              if (f.type === "sectionHeader" || f.type === "staticText") continue;
              if (!visible(f, row)) continue;
              const v = row[f.key] ?? "";
              const req =
                f.required || (f.key === "allergiesNotes" && rules.requireAllergiesNotes);
              if (req && (f.type === "checkbox" || f.type === "boolean") && v !== "true") {
                return `Child ${i + 1}: ${f.label} is required.`;
              }
              if (req && f.type !== "checkbox" && f.type !== "boolean" && !v.trim()) {
                return `Child ${i + 1}: ${f.label} is required.`;
              }
            }
          }
        }
      }
      if (s === 2) {
        for (const sec of consentSections) {
          for (const f of def.fields.filter((x) => x.sectionId === sec.id)) {
            if (f.type === "sectionHeader" || f.type === "staticText") continue;
            if (!visible(f, guardian)) continue;
            const v = guardian[f.key] ?? "";
            const req =
              f.required ||
              (f.key === "guardianEmail" && rules.requireGuardianEmail) ||
              (f.key === "guardianPhone" && rules.requireGuardianPhone);
            if (req && (f.type === "checkbox" || f.type === "boolean") && v !== "true") {
              return `${f.label} is required.`;
            }
            if (req && f.type !== "checkbox" && f.type !== "boolean" && !v.trim()) {
              return `${f.label} is required.`;
            }
            if (f.key === "guardianEmail" && v.trim() && !emailLooksValid(v)) {
              return "Please enter a valid email address.";
            }
          }
        }
        if (!confirmAccurate) return "Please confirm the information is accurate to continue.";
      }
      return null;
    },
    [def, guardianSections, childSections, consentSections, guardian, children, confirmAccurate, rules],
  );

  const goNext = () => {
    const err = validateStep(step);
    setLocalError(err);
    if (err) return;
    setStep((x) => Math.min(x + 1, TOTAL_STEPS - 1));
  };

  const goBack = () => {
    setLocalError(null);
    setStep((x) => Math.max(x - 1, 0));
  };

  const showEmailError =
    emailBlurred && (guardian.guardianEmail?.trim() ?? "") && !emailLooksValid(guardian.guardianEmail ?? "");

  if (seasons.length === 0 || !def || !current) {
    return (
      <div className="rounded-2xl border border-neutral-200 bg-white px-6 py-10 text-center text-neutral-600 shadow-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
        <p className="text-base font-medium text-neutral-900 dark:text-neutral-100">
          Online registration isn’t open right now
        </p>
        <p className="mt-2 text-sm">
          Please contact {churchDisplayName}
          {contactPhone ? ` at ${contactPhone}` : ""}
          {contactEmail ? ` or ${contactEmail}` : ""}.
        </p>
      </div>
    );
  }

  const success = state?.ok === true;

  if (success) {
    return (
      <div className="relative z-0 mx-auto max-w-lg sm:max-w-xl">
        <div className="rounded-2xl border border-emerald-200 bg-white px-6 py-10 text-center shadow-lg dark:border-emerald-900/50 dark:bg-neutral-950">
          <CheckCircle2 className="mx-auto size-14 text-emerald-600 dark:text-emerald-400" aria-hidden />
          <p className="mt-4 text-lg font-semibold text-neutral-900 dark:text-neutral-50">You’re all set!</p>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">{state?.message}</p>
          {state?.registrationCode && (
            <p className="mt-4 font-mono text-sm font-semibold text-brand">Code: {state.registrationCode}</p>
          )}
          <p className="mt-6 text-xs text-neutral-500">
            Questions?{" "}
            {contactEmail ? (
              <a className="font-medium text-brand underline" href={`mailto:${contactEmail}`}>
                {contactEmail}
              </a>
            ) : null}
            {contactEmail && contactPhone ? " · " : null}
            {contactPhone ? (
              <a className="font-medium text-brand underline" href={`tel:${phoneDigits(contactPhone)}`}>
                {contactPhone}
              </a>
            ) : null}
            {!contactEmail && !contactPhone ? `Reach out to ${churchDisplayName}.` : null}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative isolate pb-28 md:pb-8">
      {current.backgroundImageUrl ? (
        <>
          <div
            aria-hidden
            className="pointer-events-none fixed inset-0 -z-20 scale-105 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: `url(${JSON.stringify(current.backgroundImageUrl)})` }}
          />
          <div className="pointer-events-none fixed inset-0 -z-10 bg-neutral-950/60 backdrop-blur-2xl dark:bg-black/75" />
        </>
      ) : (
        <div className="pointer-events-none fixed inset-0 -z-10 bg-gradient-to-b from-brand-muted/45 via-background to-background dark:from-brand-muted/15" />
      )}

      <div className="relative z-0 mx-auto max-w-lg sm:max-w-xl">
        <div className="rounded-2xl border border-brand/25 bg-gradient-to-br from-brand-muted/60 to-white px-5 py-6 text-center shadow-md dark:from-brand-muted/25 dark:to-neutral-900 dark:border-brand/35 sm:px-8">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-brand text-brand-foreground shadow-md">
            <Sparkles className="size-7" aria-hidden />
          </div>
          <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-brand">{churchDisplayName}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50 sm:text-3xl">
            {current.formTitle || current.name}
          </h1>
          <p className="mt-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
            {formatEventRange(current.startDate, current.endDate)}
          </p>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
            {current.welcomeMessage?.trim() ||
              `Please complete this form to register your ${children.length > 1 ? "children" : "child"} for VBS.`}
          </p>
        </div>

        <div className="mt-6 px-1">
          <div className="flex items-center justify-between text-xs font-medium text-neutral-500 dark:text-neutral-400">
            <span>
              Step {step + 1} of {TOTAL_STEPS}
            </span>
            <span className="text-neutral-700 dark:text-neutral-300">{STEP_LABELS[step]}</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
            <div
              className="h-full rounded-full bg-brand transition-[width] duration-300 ease-out"
              style={{ width: `${((step + 1) / TOTAL_STEPS) * 100}%` }}
            />
          </div>
        </div>

        <form action={formAction} className="mt-6 space-y-5">
          <div className="pointer-events-none absolute -left-[10000px] h-0 w-0 overflow-hidden opacity-0">
            <label htmlFor="company">Company</label>
            <input type="text" id="company" name="company" tabIndex={-1} autoComplete="off" />
          </div>

          <input type="hidden" name="seasonId" value={seasonId} readOnly />
          <input type="hidden" name="__vbsSubmitNonce" value={clientSubmitKey} readOnly />
          <input type="hidden" name="childCount" value={children.length} readOnly />
          <input type="hidden" name="confirmedAccurate" value={confirmAccurate ? "true" : "false"} readOnly />

          {def.fields.map((f) => {
            const sec = def.sections.find((s) => s.id === f.sectionId);
            if (sec?.audience !== "guardian" && sec?.audience !== "consent") return null;
            if (f.type === "sectionHeader" || f.type === "staticText") return null;
            const v = guardian[f.key] ?? "";
            return (
              <input key={f.id} type="hidden" name={f.key} value={v} readOnly />
            );
          })}
          {children.map((ch, i) =>
            childFieldKeys.map((key) => (
              <input key={`${ch.id}-${key}`} type="hidden" name={`${key}__${i}`} value={ch.values[key] ?? ""} readOnly />
            )),
          )}

          {state && !state.ok && !hasFieldErrors(state) && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100">
              {state.message}
            </div>
          )}
          {state && !state.ok && hasFieldErrors(state) && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
              {state.message}
            </div>
          )}
          {localError && (
            <div
              className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100"
              role="alert"
            >
              <X className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>{localError}</span>
            </div>
          )}

          {step === 0 && (
            <div className={sectionCard}>
              <SectionHeader
                icon={UserRound}
                title="Parent / guardian"
                description="We’ll use this for event updates and emergencies."
              />
              {seasons.length > 1 && (
                <div className="mb-5">
                  <label htmlFor="seasonSel" className={labelClass}>
                    VBS session
                  </label>
                  <select
                    id="seasonSel"
                    value={seasonId}
                    onChange={(e) => setSeasonId(e.target.value)}
                    className={inputClass}
                  >
                    {seasons.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.year})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {guardianSections.map((sec) => (
                <div key={sec.id} className="mb-6 last:mb-0">
                  <h3 className="mb-3 text-sm font-bold text-neutral-800 dark:text-neutral-200">{sec.title}</h3>
                  {sec.description ? <p className="mb-3 text-sm text-neutral-600">{sec.description}</p> : null}
                  <div className="grid gap-4 sm:grid-cols-2">
                    {def.fields
                      .filter((f) => f.sectionId === sec.id)
                      .map((f) => {
                        if (f.type === "sectionHeader" || f.type === "staticText") {
                          return (
                            <div key={f.id} className="sm:col-span-2">
                              {renderFieldInput(f, "", () => {}, rules)}
                            </div>
                          );
                        }
                        if (!visible(f, guardian)) return null;
                        return (
                          <div
                            key={f.id}
                            className={
                              f.type === "textarea" || f.type === "radio" ? "sm:col-span-2" : ""
                            }
                          >
                            {renderFieldInput(
                              f,
                              guardian[f.key] ?? "",
                              (v) => setGuardian((g) => ({ ...g, [f.key]: v })),
                              rules,
                              f.key === "guardianEmail"
                                ? {
                                    onBlur: () => setEmailBlurred(true),
                                  }
                                : undefined,
                            )}
                            {f.key === "guardianEmail" ? (
                              <>
                                <p className={hintClass}>We’ll only use this for VBS-related communication.</p>
                                {showEmailError ? (
                                  <p className={`${hintClass} text-red-600`}>Enter a valid email address.</p>
                                ) : null}
                              </>
                            ) : null}
                          </div>
                        );
                      })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {step === 1 && (
            <div className={sectionCard}>
              <SectionHeader
                icon={Baby}
                title="Children attending VBS"
                description="Add every child who will participate on this form."
              />
              {children.map((ch, idx) => (
                <div
                  key={ch.id}
                  className="mb-4 rounded-xl border border-neutral-200 bg-neutral-50/80 p-4 dark:border-neutral-700 dark:bg-neutral-900/50"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-sm font-bold text-brand">Child {idx + 1}</span>
                    {children.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setChildren((r) => (r.length <= 1 ? r : r.filter((x) => x.id !== ch.id)))}
                        className="inline-flex items-center gap-1 text-xs font-medium text-red-700 dark:text-red-300"
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                        Remove
                      </button>
                    )}
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {childSections.flatMap((sec) =>
                      def.fields
                        .filter((f) => f.sectionId === sec.id)
                        .map((f) => {
                          if (f.type === "sectionHeader" || f.type === "staticText") {
                            return (
                              <div key={f.id} className="sm:col-span-2">
                                {renderFieldInput(f, "", () => {}, rules)}
                              </div>
                            );
                          }
                          if (!visible(f, ch.values)) return null;
                          return (
                            <div
                              key={f.id}
                              className={
                                f.type === "textarea" || f.type === "radio" ? "sm:col-span-2" : ""
                              }
                            >
                              {renderFieldInput(
                                f,
                                ch.values[f.key] ?? "",
                                (v) =>
                                  setChildren((rows) =>
                                    rows.map((r) =>
                                      r.id === ch.id ? { ...r, values: { ...r.values, [f.key]: v } } : r,
                                    ),
                                  ),
                                rules,
                              )}
                            </div>
                          );
                        }),
                    )}
                  </div>
                </div>
              ))}
              {children.length < 8 && (
                <button
                  type="button"
                  onClick={() =>
                    setChildren((r) => [
                      ...r,
                      { id: newChildId(), values: Object.fromEntries(childFieldKeys.map((k) => [k, ""])) },
                    ])
                  }
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-brand/40 bg-brand-muted/20 py-3 text-sm font-semibold text-brand dark:bg-brand-muted/10"
                >
                  <Plus className="size-4" aria-hidden />
                  Add another child
                </button>
              )}
            </div>
          )}

          {step === 2 && (
            <div className={sectionCard}>
              <SectionHeader
                icon={Shield}
                title="Privacy & consent"
                description="Your family’s details are handled with care."
              />
              <ul className="space-y-3 text-sm text-neutral-700 dark:text-neutral-300">
                <li className="flex gap-2">
                  <Lock className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
                  <span>
                    Information is used only for{" "}
                    <strong>{churchDisplayName} VBS</strong> planning, safety, and follow-up.
                  </span>
                </li>
                <li className="flex gap-2">
                  <Heart className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
                  <span>We do not sell your data. Access is limited to authorized church staff.</span>
                </li>
              </ul>
              {consentSections.map((sec) => (
                <div key={sec.id} className="mt-5">
                  <h3 className="font-semibold text-neutral-900 dark:text-neutral-50">{sec.title}</h3>
                  {def.fields
                    .filter((f) => f.sectionId === sec.id)
                    .map((f) => {
                      if (!visible(f, guardian)) return null;
                      return (
                        <div key={f.id} className="mt-2">
                          {renderFieldInput(
                            f,
                            guardian[f.key] ?? "",
                            (v) => setGuardian((g) => ({ ...g, [f.key]: v })),
                            rules,
                          )}
                        </div>
                      );
                    })}
                </div>
              ))}
              {(contactEmail || contactPhone) && (
                <div className="mt-5 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm dark:border-neutral-700 dark:bg-neutral-900/60">
                  <p className="font-semibold">Questions?</p>
                  <p className="mt-1 text-neutral-600 dark:text-neutral-400">
                    {contactEmail ? (
                      <a href={`mailto:${contactEmail}`} className="font-medium text-brand underline">
                        {contactEmail}
                      </a>
                    ) : null}
                    {contactEmail && contactPhone ? " · " : null}
                    {contactPhone ? (
                      <a href={`tel:${phoneDigits(contactPhone)}`} className="font-medium text-brand underline">
                        {contactPhone}
                      </a>
                    ) : null}
                  </p>
                </div>
              )}
              <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-4 dark:border-neutral-600 dark:bg-neutral-900">
                <input
                  type="checkbox"
                  checked={confirmAccurate}
                  onChange={(e) => setConfirmAccurate(e.target.checked)}
                  className="mt-1 size-5 accent-brand"
                />
                <span className="text-sm">
                  I confirm the information is accurate to the best of my knowledge, and I agree to the church using it
                  for this VBS event.
                </span>
              </label>
            </div>
          )}

          {step === 3 && (
            <div className={sectionCard}>
              <SectionHeader
                icon={CheckCircle2}
                title="Review & submit"
                description="Take a quick look before sending."
              />
              <div className="space-y-4 text-sm">
                <div>
                  <p className="text-xs font-bold uppercase text-neutral-500">Guardian</p>
                  <ul className="mt-1 space-y-1">
                    {Object.entries(guardian).map(([k, v]) =>
                      v ? (
                        <li key={k}>
                          <span className="text-neutral-500">{k}: </span>
                          <span className="font-medium text-neutral-900 dark:text-neutral-50">{v}</span>
                        </li>
                      ) : null,
                    )}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase text-neutral-500">Children ({children.length})</p>
                  <ul className="mt-2 space-y-2">
                    {children.map((ch, i) => (
                      <li key={ch.id} className="rounded-lg border border-neutral-200 p-2 dark:border-neutral-700">
                        <span className="font-semibold">Child {i + 1}</span>
                        <ul className="mt-1 text-neutral-600">
                          {Object.entries(ch.values).map(([k, v]) =>
                            v ? (
                              <li key={k}>
                                {k}: {v}
                              </li>
                            ) : null,
                          )}
                        </ul>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          <div className="hidden flex-wrap items-center justify-between gap-3 md:flex">
            <div>
              {step > 0 ? (
                <button
                  type="button"
                  onClick={goBack}
                  className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-neutral-300 px-4 py-2 text-sm font-semibold dark:border-neutral-600"
                >
                  <ChevronLeft className="size-4" aria-hidden />
                  Back
                </button>
              ) : (
                <span className="text-sm text-neutral-500">Need help? Check the privacy step.</span>
              )}
            </div>
            <div>
              {step < TOTAL_STEPS - 1 ? (
                <button
                  type="button"
                  onClick={goNext}
                  className="inline-flex min-h-11 items-center gap-1 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground shadow-sm"
                >
                  Continue
                  <ChevronRight className="size-4" aria-hidden />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={pending}
                  className="inline-flex min-h-11 rounded-xl bg-brand px-6 py-2.5 text-sm font-semibold text-brand-foreground disabled:opacity-50"
                >
                  {pending ? "Submitting…" : "Submit registration"}
                </button>
              )}
            </div>
          </div>

          <div className="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-200 bg-white/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-4px_20px_rgba(0,0,0,0.08)] backdrop-blur-md dark:border-neutral-800 dark:bg-neutral-950/95 md:hidden">
            <div className="mx-auto flex max-w-lg gap-2">
              {step > 0 ? (
                <button
                  type="button"
                  onClick={goBack}
                  className="inline-flex min-h-12 flex-1 items-center justify-center gap-1 rounded-xl border border-neutral-300 text-sm font-semibold dark:border-neutral-600"
                >
                  <ChevronLeft className="size-4" aria-hidden />
                  Back
                </button>
              ) : (
                <div className="min-h-12 flex-1" />
              )}
              {step < TOTAL_STEPS - 1 ? (
                <button
                  type="button"
                  onClick={goNext}
                  className="inline-flex min-h-12 flex-[2] items-center justify-center gap-1 rounded-xl bg-brand text-sm font-semibold text-brand-foreground"
                >
                  Continue
                  <ChevronRight className="size-4" aria-hidden />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={pending}
                  className="inline-flex min-h-12 flex-[2] items-center justify-center rounded-xl bg-brand text-sm font-semibold text-brand-foreground disabled:opacity-50"
                >
                  {pending ? "Submitting…" : "Submit"}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
