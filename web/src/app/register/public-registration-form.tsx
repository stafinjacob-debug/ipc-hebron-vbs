"use client";

import { useActionState, useCallback, useMemo, useState } from "react";
import {
  Baby,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Heart,
  Lock,
  Plus,
  Shield,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import {
  defaultPublicFieldRules,
  type PublicRegistrationFieldRules,
} from "@/lib/public-registration";
import type { PublicRegistrationLayout } from "@/generated/prisma";
import { clampRegistrationBackgroundDimmingPercent } from "@/lib/registration-background-scrim";
import { formatPhoneInput, phoneDigits } from "@/lib/phone-format";
import { RegistrationBackgroundMedia } from "./registration-background-media";
import { RegistrationHeroBrand } from "./registration-hero-brand";
import { submitPublicRegistration, type PublicRegisterState } from "./actions";

export type PublicSeasonOption = {
  id: string;
  name: string;
  year: number;
  startDate: string;
  endDate: string;
  welcomeMessage: string | null;
  backgroundImageUrl: string | null;
  backgroundVideoUrl?: string | null;
  backgroundLayout?: PublicRegistrationLayout;
  /** 0–100: overlay alpha on the background photo. */
  backgroundDimmingPercent: number;
  rules: PublicRegistrationFieldRules;
};

export type RegisterContactProps = {
  contactEmail: string;
  contactPhone: string;
  churchDisplayName: string;
};

type ChildDraft = {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  allergyMode: "none" | "details";
  allergyDetails: string;
};

const STEP_LABELS = ["Guardian", "Children", "Privacy", "Review"] as const;
const TOTAL_STEPS = STEP_LABELS.length;

const initial: PublicRegisterState | null = null;

function hasFieldErrors(s: PublicRegisterState | null): boolean {
  return !!s?.fieldErrors && Object.keys(s.fieldErrors).length > 0;
}

function newChildRow(): ChildDraft {
  return {
    id:
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `c-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    firstName: "",
    lastName: "",
    dateOfBirth: "",
    allergyMode: "none",
    allergyDetails: "",
  };
}

function emailLooksValid(v: string): boolean {
  if (!v.trim()) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

function buildChildrenPayload(children: ChildDraft[], rules: PublicRegistrationFieldRules): string {
  return JSON.stringify(
    children.map((c) => ({
      firstName: c.firstName.trim(),
      lastName: c.lastName.trim(),
      childDateOfBirth: c.dateOfBirth,
      allergiesNotes:
        c.allergyMode === "none"
          ? rules.requireAllergiesNotes
            ? "None"
            : null
          : c.allergyDetails.trim() || null,
    })),
  );
}

const labelClass = "block text-sm font-semibold text-neutral-900 dark:text-neutral-100";
const hintClass = "mt-1 text-xs text-neutral-500 dark:text-neutral-400";
const inputClass =
  "mt-1.5 w-full min-h-11 rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 text-base text-neutral-900 shadow-sm placeholder:text-neutral-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder:text-neutral-500";
const inputError = "border-red-400 focus:border-red-500 focus:ring-red-200 dark:border-red-500";
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

export function PublicRegistrationForm({
  seasons,
  contactEmail,
  contactPhone,
  churchDisplayName,
}: {
  seasons: PublicSeasonOption[];
} & RegisterContactProps) {
  const [state, formAction, pending] = useActionState(submitPublicRegistration, initial);
  const clientSubmitKey = useMemo(
    () =>
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `idem-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
    [],
  );
  const [seasonId, setSeasonId] = useState(seasons[0]?.id ?? "");
  const [step, setStep] = useState(0);

  const [guardianFirstName, setGuardianFirstName] = useState("");
  const [guardianLastName, setGuardianLastName] = useState("");
  const [guardianEmail, setGuardianEmail] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [emailBlurred, setEmailBlurred] = useState(false);

  const [children, setChildren] = useState<ChildDraft[]>(() => [newChildRow()]);
  const [confirmAccurate, setConfirmAccurate] = useState(false);
  const [smsConsent, setSmsConsent] = useState(false);

  const [localError, setLocalError] = useState<string | null>(null);

  const current = useMemo(
    () => seasons.find((s) => s.id === seasonId),
    [seasons, seasonId],
  );
  const dimmingPercent = clampRegistrationBackgroundDimmingPercent(current?.backgroundDimmingPercent);
  const rules: PublicRegistrationFieldRules = useMemo(
    () => current?.rules ?? defaultPublicFieldRules,
    [current?.rules],
  );

  const childrenPayload = useMemo(
    () => buildChildrenPayload(children, rules),
    [children, rules],
  );

  const formatEventRange = useCallback((startIso: string, endIso: string) => {
    const start = new Date(startIso);
    const end = new Date(endIso);
    const o = { month: "long" as const, day: "numeric" as const, year: "numeric" as const };
    return `${start.toLocaleDateString(undefined, o)} – ${end.toLocaleDateString(undefined, o)}`;
  }, []);

  const validateStep = useCallback(
    (s: number): string | null => {
      if (s === 0) {
        if (!seasonId) return "Please choose a VBS season.";
        if (!guardianFirstName.trim() || !guardianLastName.trim()) {
          return "Please enter the parent or guardian’s name.";
        }
        if (rules.requireGuardianEmail && !guardianEmail.trim()) {
          return "Email is required for this program.";
        }
        if (guardianEmail.trim() && !emailLooksValid(guardianEmail)) {
          return "Please enter a valid email address.";
        }
        if (rules.requireGuardianPhone && !phoneDigits(guardianPhone)) {
          return "Phone is required for this program.";
        }
      }
      if (s === 1) {
        for (let i = 0; i < children.length; i++) {
          const c = children[i];
          if (!c.firstName.trim() || !c.lastName.trim()) {
            return `Please complete the name for child ${i + 1}.`;
          }
          if (!c.dateOfBirth) {
            return `Please choose a date of birth for child ${i + 1}.`;
          }
          if (c.allergyMode === "details" && !c.allergyDetails.trim()) {
            return `Please add details for child ${i + 1}, or choose “No known allergies.”`;
          }
        }
      }
      if (s === 2) {
        if (!confirmAccurate) return "Please confirm the information is accurate to continue.";
        if (smsConsent && !phoneDigits(guardianPhone)) {
          return "Please provide a valid phone number to receive SMS updates.";
        }
      }
      return null;
    },
    [
      seasonId,
      guardianFirstName,
      guardianLastName,
      guardianEmail,
      guardianPhone,
      children,
      confirmAccurate,
      smsConsent,
      rules,
    ],
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

  const updateChild = (id: string, patch: Partial<ChildDraft>) => {
    setChildren((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const removeChild = (id: string) => {
    setChildren((rows) => (rows.length <= 1 ? rows : rows.filter((r) => r.id !== id)));
  };

  if (seasons.length === 0) {
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

  const showEmailError = emailBlurred && guardianEmail.trim() && !emailLooksValid(guardianEmail);
  const success = state?.ok === true;

  if (success) {
    return (
      <div className="relative z-0 mx-auto max-w-lg sm:max-w-xl">
        <div className="rounded-2xl border border-emerald-200 bg-white px-6 py-10 text-center shadow-lg dark:border-emerald-900/50 dark:bg-neutral-950">
          <CheckCircle2 className="mx-auto size-14 text-emerald-600 dark:text-emerald-400" aria-hidden />
          <p className="mt-4 text-lg font-semibold text-neutral-900 dark:text-neutral-50">You’re all set!</p>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">{state?.message}</p>
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
      <RegistrationBackgroundMedia
        videoUrl={current?.backgroundVideoUrl}
        imageUrl={current?.backgroundImageUrl}
        dimmingPercent={dimmingPercent}
        variant="fixed"
      />

      <div className="relative z-0 mx-auto max-w-lg sm:max-w-xl">
        {/* Hero */}
        <div className="rounded-2xl border border-brand/25 bg-gradient-to-br from-brand-muted/60 to-white px-5 py-6 text-center shadow-md dark:from-brand-muted/25 dark:to-neutral-900 dark:border-brand/35 sm:px-8">
          <RegistrationHeroBrand churchDisplayName={churchDisplayName} />
          <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-brand">{churchDisplayName}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50 sm:text-3xl">
            {current?.name ?? "Vacation Bible School"}
          </h1>
          {current && (
            <p className="mt-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
              {formatEventRange(current.startDate, current.endDate)}
            </p>
          )}
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
            Please complete this short form to register your{" "}
            {children.length > 1 ? "children" : "child"} for VBS. It only takes a few minutes—we’ll use this
            information for event communication and emergencies.
          </p>
        </div>

        {/* Progress */}
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
          <input type="hidden" name="guardianFirstName" value={guardianFirstName} />
          <input type="hidden" name="guardianLastName" value={guardianLastName} />
          <input type="hidden" name="guardianEmail" value={guardianEmail} />
          <input type="hidden" name="guardianPhone" value={guardianPhone} />
          <input type="hidden" name="childrenPayload" value={childrenPayload} />
          <input type="hidden" name="confirmedAccurate" value={confirmAccurate ? "true" : "false"} />
          <input type="hidden" name="smsConsent" value={smsConsent ? "true" : "false"} />

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

          {/* Step 0 — Guardian */}
          {step === 0 && (
            <div className={sectionCard}>
              <SectionHeader
                icon={UserRound}
                title="Parent / guardian"
                description="We’ll use this for event updates, emergencies, and pickup questions."
              />

              {seasons.length > 1 && (
                <div className="mb-5">
                  <label htmlFor="seasonIdSel" className={labelClass}>
                    VBS session
                  </label>
                  <select
                    id="seasonIdSel"
                    value={seasonId}
                    onChange={(e) => {
                      setSeasonId(e.target.value);
                      setLocalError(null);
                    }}
                    className={inputClass}
                  >
                    {seasons.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.year})
                      </option>
                    ))}
                  </select>
                  {state?.fieldErrors?.seasonId && (
                    <p className={`${hintClass} text-red-600 dark:text-red-400`}>{state.fieldErrors.seasonId[0]}</p>
                  )}
                </div>
              )}

              {current?.welcomeMessage ? (
                <div className="mb-5 rounded-xl border border-brand/20 bg-brand-muted/25 px-4 py-3 text-sm leading-relaxed text-neutral-800 dark:border-brand/30 dark:bg-brand-muted/15 dark:text-neutral-200 whitespace-pre-wrap">
                  {current.welcomeMessage}
                </div>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="gfn" className={labelClass}>
                    First name <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="gfn"
                    value={guardianFirstName}
                    onChange={(e) => setGuardianFirstName(e.target.value)}
                    autoComplete="given-name"
                    className={inputClass}
                    placeholder="e.g. Maria"
                  />
                  {state?.fieldErrors?.guardianFirstName && (
                    <p className={`${hintClass} text-red-600`}>{state.fieldErrors.guardianFirstName[0]}</p>
                  )}
                </div>
                <div>
                  <label htmlFor="gln" className={labelClass}>
                    Last name <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="gln"
                    value={guardianLastName}
                    onChange={(e) => setGuardianLastName(e.target.value)}
                    autoComplete="family-name"
                    className={inputClass}
                    placeholder="e.g. Santos"
                  />
                  {state?.fieldErrors?.guardianLastName && (
                    <p className={`${hintClass} text-red-600`}>{state.fieldErrors.guardianLastName[0]}</p>
                  )}
                </div>
              </div>

              <div className="mt-4">
                <label htmlFor="gem" className={labelClass}>
                  Email
                  {rules.requireGuardianEmail ? (
                    <span className="text-red-600"> *</span>
                  ) : (
                    <span className="font-normal text-neutral-500"> (optional)</span>
                  )}
                </label>
                <input
                  id="gem"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={guardianEmail}
                  onChange={(e) => setGuardianEmail(e.target.value)}
                  onBlur={() => setEmailBlurred(true)}
                  className={`${inputClass} ${showEmailError ? inputError : ""}`}
                  placeholder="name@example.com"
                />
                <p className={hintClass}>We’ll only use this for VBS-related communication.</p>
                {showEmailError && <p className={`${hintClass} text-red-600`}>Enter a valid email address.</p>}
                {state?.fieldErrors?.guardianEmail && (
                  <p className={`${hintClass} text-red-600`}>{state.fieldErrors.guardianEmail[0]}</p>
                )}
              </div>

              <div className="mt-4">
                <label htmlFor="gph" className={labelClass}>
                  Phone
                  {rules.requireGuardianPhone ? (
                    <span className="text-red-600"> *</span>
                  ) : (
                    <span className="font-normal text-neutral-500"> (optional)</span>
                  )}
                </label>
                <input
                  id="gph"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  value={guardianPhone}
                  onChange={(e) => setGuardianPhone(formatPhoneInput(e.target.value))}
                  className={inputClass}
                  placeholder="(555) 123-4567"
                />
                <p className={hintClass}>For day-of questions or emergencies.</p>
                {state?.fieldErrors?.guardianPhone && (
                  <p className={`${hintClass} text-red-600`}>{state.fieldErrors.guardianPhone[0]}</p>
                )}
              </div>
            </div>
          )}

          {/* Step 1 — Children */}
          {step === 1 && (
            <div className="space-y-4">
              <div className={sectionCard}>
                <SectionHeader
                  icon={Baby}
                  title="Children attending VBS"
                  description="Add every child who will participate. You can register siblings on this same form—parent info stays the same."
                />

                {children.map((c, index) => (
                  <div
                    key={c.id}
                    className="mb-4 rounded-xl border border-neutral-200 bg-neutral-50/80 p-4 last:mb-0 dark:border-neutral-700 dark:bg-neutral-900/50"
                  >
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-brand">Child {index + 1}</span>
                      {children.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeChild(c.id)}
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/40"
                        >
                          <Trash2 className="size-3.5" aria-hidden />
                          Remove
                        </button>
                      )}
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className={labelClass} htmlFor={`cfn-${c.id}`}>
                          First name <span className="text-red-600">*</span>
                        </label>
                        <input
                          id={`cfn-${c.id}`}
                          value={c.firstName}
                          onChange={(e) => updateChild(c.id, { firstName: e.target.value })}
                          className={inputClass}
                          placeholder="Child’s first name"
                          autoComplete="off"
                        />
                      </div>
                      <div>
                        <label className={labelClass} htmlFor={`cln-${c.id}`}>
                          Last name <span className="text-red-600">*</span>
                        </label>
                        <input
                          id={`cln-${c.id}`}
                          value={c.lastName}
                          onChange={(e) => updateChild(c.id, { lastName: e.target.value })}
                          className={inputClass}
                          placeholder="Child’s last name"
                          autoComplete="off"
                        />
                      </div>
                    </div>
                    <div className="mt-4">
                      <label className={labelClass} htmlFor={`cdob-${c.id}`}>
                        Date of birth <span className="text-red-600">*</span>
                      </label>
                      <input
                        id={`cdob-${c.id}`}
                        type="date"
                        value={c.dateOfBirth}
                        onChange={(e) => updateChild(c.id, { dateOfBirth: e.target.value })}
                        className={inputClass}
                      />
                      <p className={hintClass}>Used to place your child in the right age group.</p>
                    </div>

                    <div className="mt-4">
                      <p className={labelClass}>Allergies or medical notes</p>
                      <p className={hintClass}>
                        {rules.requireAllergiesNotes
                          ? "Required for this program—you can enter “None” if not applicable."
                          : "Optional—helps teachers keep everyone safe."}
                      </p>
                      <div className="mt-2 space-y-2">
                        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-neutral-200 bg-white px-3 py-3 dark:border-neutral-600 dark:bg-neutral-900">
                          <input
                            type="radio"
                            name={`allergy-${c.id}`}
                            checked={c.allergyMode === "none"}
                            onChange={() => updateChild(c.id, { allergyMode: "none", allergyDetails: "" })}
                            className="size-4 accent-brand"
                          />
                          <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                            No known allergies or medical notes
                          </span>
                        </label>
                        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-neutral-200 bg-white px-3 py-3 dark:border-neutral-600 dark:bg-neutral-900">
                          <input
                            type="radio"
                            name={`allergy-${c.id}`}
                            checked={c.allergyMode === "details"}
                            onChange={() => updateChild(c.id, { allergyMode: "details" })}
                            className="size-4 accent-brand"
                          />
                          <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                            Yes, I’d like to add details
                          </span>
                        </label>
                      </div>
                      {c.allergyMode === "details" && (
                        <textarea
                          value={c.allergyDetails}
                          onChange={(e) => updateChild(c.id, { allergyDetails: e.target.value })}
                          rows={3}
                          className={`${inputClass} mt-2 resize-y`}
                          placeholder="e.g. peanut allergy, carries EpiPen"
                        />
                      )}
                    </div>
                  </div>
                ))}

                {children.length < 8 && (
                  <button
                    type="button"
                    onClick={() => setChildren((r) => [...r, newChildRow()])}
                    className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-brand/40 bg-brand-muted/20 py-3 text-sm font-semibold text-brand transition hover:bg-brand-muted/35 dark:bg-brand-muted/10"
                  >
                    <Plus className="size-4" aria-hidden />
                    Add another child
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Step 2 — Privacy */}
          {step === 2 && (
            <div className={sectionCard}>
              <SectionHeader
                icon={Shield}
                title="Privacy & how we use this information"
                description="Your family’s details are handled with care."
              />
              <ul className="space-y-3 text-sm text-neutral-700 dark:text-neutral-300">
                <li className="flex gap-2">
                  <Lock className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
                  <span>
                    Information is used only for{" "}
                    <strong className="text-neutral-900 dark:text-neutral-100">{churchDisplayName} VBS</strong>{" "}
                    planning, safety, and follow-up.
                  </span>
                </li>
                <li className="flex gap-2">
                  <Heart className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
                  <span>We do not sell your data. Access is limited to authorized church staff and volunteers.</span>
                </li>
              </ul>
              {(contactEmail || contactPhone) && (
                <div className="mt-5 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm dark:border-neutral-700 dark:bg-neutral-900/60">
                  <p className="font-semibold text-neutral-900 dark:text-neutral-100">Questions?</p>
                  <p className="mt-1 text-neutral-600 dark:text-neutral-400">
                    Contact the VBS team
                    {contactEmail ? (
                      <>
                        {" "}
                        at{" "}
                        <a href={`mailto:${contactEmail}`} className="font-medium text-brand underline">
                          {contactEmail}
                        </a>
                      </>
                    ) : null}
                    {contactPhone ? (
                      <>
                        {contactEmail ? " or " : " at "}
                        <a href={`tel:${phoneDigits(contactPhone)}`} className="font-medium text-brand underline">
                          {contactPhone}
                        </a>
                      </>
                    ) : null}
                    .
                  </p>
                </div>
              )}
              <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-4 dark:border-neutral-600 dark:bg-neutral-900">
                <input
                  type="checkbox"
                  checked={confirmAccurate}
                  onChange={(e) => setConfirmAccurate(e.target.checked)}
                  className="mt-1 size-5 shrink-0 rounded accent-brand"
                />
                <span className="text-sm text-neutral-800 dark:text-neutral-200">
                  I confirm the information I’ve provided is accurate to the best of my knowledge, and I agree to the
                  church using it for this VBS event.
                </span>
              </label>
              <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-4 dark:border-neutral-600 dark:bg-neutral-900">
                <input
                  type="checkbox"
                  checked={smsConsent}
                  onChange={(e) => setSmsConsent(e.target.checked)}
                  className="mt-1 size-5 shrink-0 rounded accent-brand"
                />
                <span className="text-sm text-neutral-800 dark:text-neutral-200">
                  I agree to receive SMS text messages on my provided phone number for VBS event updates and
                  announcements.
                </span>
              </label>
              {state?.fieldErrors?.confirmedAccurate && (
                <p className={`${hintClass} mt-2 text-red-600`}>{state.fieldErrors.confirmedAccurate[0]}</p>
              )}
            </div>
          )}

          {/* Step 3 — Review */}
          {step === 3 && (
            <div className={sectionCard}>
              <SectionHeader
                icon={CheckCircle2}
                title="Review & submit"
                description="Take a quick look before you send—then we’ll notify the office."
              />
              <div className="space-y-4 text-sm">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-neutral-500">Guardian</p>
                  <p className="mt-1 font-medium text-neutral-900 dark:text-neutral-50">
                    {guardianFirstName} {guardianLastName}
                  </p>
                  {guardianEmail && <p className="text-neutral-600 dark:text-neutral-400">{guardianEmail}</p>}
                  {guardianPhone && <p className="text-neutral-600 dark:text-neutral-400">{guardianPhone}</p>}
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-neutral-500">Children ({children.length})</p>
                  <ul className="mt-2 space-y-2">
                    {children.map((c, i) => (
                      <li
                        key={c.id}
                        className="rounded-lg border border-neutral-200 px-3 py-2 dark:border-neutral-700"
                      >
                        <span className="font-semibold text-neutral-900 dark:text-neutral-50">
                          {i + 1}. {c.firstName || "—"} {c.lastName || "—"}
                        </span>
                        <span className="block text-neutral-600 dark:text-neutral-400">
                          DOB: {c.dateOfBirth || "—"}
                        </span>
                        <span className="block text-neutral-600 dark:text-neutral-400">
                          Medical:{" "}
                          {c.allergyMode === "none"
                            ? rules.requireAllergiesNotes
                              ? "None"
                              : "No notes provided"
                            : c.allergyDetails || "—"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-neutral-500">SMS updates</p>
                  <p className="mt-1 text-neutral-600 dark:text-neutral-400">{smsConsent ? "Consented" : "Not consented"}</p>
                </div>
              </div>
            </div>
          )}

          {/* Desktop actions */}
          <div className="hidden flex-wrap items-center justify-between gap-3 md:flex">
            <div>
              {step > 0 ? (
                <button
                  type="button"
                  onClick={goBack}
                  className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 dark:border-neutral-600 dark:text-neutral-200 dark:hover:bg-neutral-900"
                >
                  <ChevronLeft className="size-4" aria-hidden />
                  Back
                </button>
              ) : (
                <span className="text-sm text-neutral-500">Need help? See contact info on the privacy step.</span>
              )}
            </div>
            <div className="flex gap-2">
              {step < TOTAL_STEPS - 1 ? (
                <button
                  type="button"
                  onClick={goNext}
                  className="inline-flex min-h-11 items-center gap-1 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground shadow-sm hover:opacity-90"
                >
                  Continue
                  <ChevronRight className="size-4" aria-hidden />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={pending}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl bg-brand px-6 py-2.5 text-sm font-semibold text-brand-foreground shadow-sm hover:opacity-90 disabled:opacity-50"
                >
                  {pending ? "Submitting…" : "Submit registration"}
                </button>
              )}
            </div>
          </div>

          {/* Mobile sticky bar (inside form so submit works) */}
          <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/12 bg-black/70 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-10px_28px_rgba(0,0,0,0.35)] backdrop-blur-xl md:hidden">
            <div className="mx-auto flex max-w-lg gap-2">
              {step > 0 ? (
                <button
                  type="button"
                  onClick={goBack}
                  className="inline-flex min-h-12 min-w-[44px] flex-1 items-center justify-center gap-1 rounded-xl border border-white/20 bg-white/10 text-sm font-semibold text-white"
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
                  className="inline-flex min-h-12 flex-[2] items-center justify-center gap-1 rounded-xl bg-brand text-sm font-semibold text-brand-foreground shadow-sm"
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
                  {pending ? "Submitting…" : "Submit registration"}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
