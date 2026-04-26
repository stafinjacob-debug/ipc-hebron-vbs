"use client";

import type React from "react";
import { Fragment, useActionState, useCallback, useEffect, useMemo, useState } from "react";
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
import { childAgeYearsOnDate } from "@/lib/class-assignment-shared";
import type { FormDefinitionV1, FormFieldDef } from "@/lib/registration-form-definition";
import { sortSections } from "@/lib/registration-form-definition";
import { formatPhoneInput, phoneDigits } from "@/lib/phone-format";
import { parseLocalDate } from "@/lib/schemas/vbs-registration";
import {
  computeProcessingGrossUp,
  computeRegistrationBaseCents,
  formatUsdFromCents,
  includeProcessingFeeForMode,
} from "@/lib/stripe-fee-math";
import type { PublicRegistrationLayout } from "@/generated/prisma";
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
  /** MP4/WebM URL; when set, shown instead of the image on /register. */
  backgroundVideoUrl: string | null;
  /** How the form sits relative to the background on large screens. */
  backgroundLayout: PublicRegistrationLayout;
  /** 0–100: rgba overlay alpha on top of the background photo. */
  backgroundDimmingPercent: number;
  rules: PublicRegistrationFieldRules;
  formTitle: string;
  definition: FormDefinitionV1;
  minimumParticipantAgeYears: number | null;
  maximumParticipantAgeYears: number | null;
  stripeCheckoutEnabled: boolean;
  stripeAmountCents: number | null;
  stripePricingUnit: "PER_SUBMISSION" | "PER_CHILD";
  stripeProcessingFeeMode: "OPTIONAL" | "REQUIRED";
  stripeProductLabel: string | null;
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

/** Client step validation + server messages — used to show age errors by the DOB field instead of only at the top. */
function parseChildAgeGateError(message: string): { childIndex: number; message: string } | null {
  const withColon = /^Child (\d+):\s*(.+)$/i.exec(message.trim());
  if (withColon && /first day of VBS/i.test(withColon[2])) {
    const n = Number.parseInt(withColon[1], 10);
    if (Number.isFinite(n) && n >= 1) return { childIndex: n - 1, message: message.trim() };
  }
  const noColon = /^Child (\d+)\s+must be\s+(at least|at most)\s+/i.exec(message.trim());
  if (noColon && /first day of VBS/i.test(message)) {
    const n = Number.parseInt(noColon[1], 10);
    if (Number.isFinite(n) && n >= 1) return { childIndex: n - 1, message: message.trim() };
  }
  return null;
}

type AgeRuleSeason = Pick<PublicSeasonOption, "minimumParticipantAgeYears" | "maximumParticipantAgeYears" | "startDate">;

/** Returns the same message shape as step validation when DOB fails age rules; `null` if rules off, incomplete, or OK. */
function childAgeGateMessageForDob(dobStr: string, childIndex: number, season: AgeRuleSeason): string | null {
  const minY = season.minimumParticipantAgeYears;
  const maxY = season.maximumParticipantAgeYears;
  if (!((minY != null && minY >= 1) || (maxY != null && maxY >= 1))) return null;
  const trimmed = dobStr.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  let dob: Date;
  try {
    dob = parseLocalDate(trimmed);
  } catch {
    return null;
  }
  const asOf = new Date(season.startDate);
  const age = childAgeYearsOnDate(dob, asOf);
  if (minY != null && minY >= 1 && age < minY) {
    return `Child ${childIndex + 1}: Must be at least ${minY} years old on the first day of VBS.`;
  }
  if (maxY != null && maxY >= 1 && age > maxY) {
    return `Child ${childIndex + 1}: Must be at most ${maxY} years old on the first day of VBS.`;
  }
  return null;
}

function visible(field: FormFieldDef, ctx: Record<string, string>): boolean {
  if (!field.showWhen) return true;
  return (ctx[field.showWhen.fieldKey] ?? "") === field.showWhen.equals;
}

const labelClass = "block text-sm font-semibold text-neutral-100";
const hintClass = "mt-1 text-xs text-neutral-300/80";
const inputClass =
  "mt-1.5 w-full min-h-11 rounded-xl border border-white/35 bg-white px-3.5 py-2.5 text-base text-neutral-900 shadow-sm placeholder:text-neutral-500 focus:border-brand/80 focus:outline-none focus:ring-2 focus:ring-brand/30";
const sectionCard =
  "rounded-2xl border border-white/12 bg-black/40 p-5 shadow-[0_10px_30px_rgba(0,0,0,0.25)] backdrop-blur-md sm:p-6 lg:p-5";

const ALLERGY_PRESET_OPTIONS = [
  "Peanut / tree nut allergy",
  "Dairy allergy",
  "Egg allergy",
  "Gluten sensitivity / celiac",
  "Medication allergy",
  "Asthma or inhaler needed",
] as const;

type AllergyChoiceState = {
  answer: "yes" | "no" | "";
  selected: string[];
  other: string;
};

function parseAllergyChoiceState(rawValue: string): AllergyChoiceState {
  const trimmed = rawValue.trim();
  if (!trimmed) return { answer: "", selected: [], other: "" };
  if (/^none$/i.test(trimmed)) return { answer: "no", selected: [], other: "" };

  const chunks = trimmed
    .split(/[;\n]+/)
    .map((c) => c.trim())
    .filter(Boolean);
  const selected: string[] = [];
  const otherParts: string[] = [];

  for (const chunk of chunks) {
    const preset = ALLERGY_PRESET_OPTIONS.find((option) => option.toLowerCase() === chunk.toLowerCase());
    if (preset) {
      selected.push(preset);
      continue;
    }
    const otherMatch = /^other:\s*(.+)$/i.exec(chunk);
    if (otherMatch?.[1]) {
      otherParts.push(otherMatch[1].trim());
      continue;
    }
    otherParts.push(chunk);
  }

  return {
    answer: "yes",
    selected: Array.from(new Set(selected)),
    other: otherParts.join("; "),
  };
}

function serializeAllergyChoiceState(state: AllergyChoiceState): string {
  if (state.answer === "no") return "None";
  if (state.answer !== "yes") return "";
  const parts: string[] = [...state.selected];
  if (state.other.trim()) parts.push(`Other: ${state.other.trim()}`);
  return parts.join("; ");
}

function AllergiesFieldInput({
  field,
  value,
  onChange,
  required,
  helperText,
}: {
  field: FormFieldDef;
  value: string;
  onChange: (v: string) => void;
  required: boolean;
  helperText?: string;
}) {
  const [state, setState] = useState<AllergyChoiceState>(() => parseAllergyChoiceState(value));

  useEffect(() => {
    const currentSerialized = serializeAllergyChoiceState(state);
    if (value === currentSerialized) return;
    setState(parseAllergyChoiceState(value));
  }, [value, state]);

  const sync = useCallback(
    (next: AllergyChoiceState) => {
      setState(next);
      onChange(serializeAllergyChoiceState(next));
    },
    [onChange],
  );

  return (
    <div>
      <p className={labelClass}>
        {field.label}
        {required ? <span className="text-red-600"> *</span> : <span className="font-normal text-neutral-500"> (optional)</span>}
      </p>
      <p className={hintClass}>{helperText}</p>
      <div className="mt-2 space-y-2">
        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/15 bg-white/8 px-3 py-3">
          <input
            type="radio"
            name={`allergy-answer-${field.id}`}
            checked={state.answer === "no"}
            onChange={() => sync({ answer: "no", selected: [], other: "" })}
            className="size-4 accent-brand"
          />
          <span className="text-sm font-medium text-neutral-100">No</span>
        </label>
        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/15 bg-white/8 px-3 py-3">
          <input
            type="radio"
            name={`allergy-answer-${field.id}`}
            checked={state.answer === "yes"}
            onChange={() => sync({ ...state, answer: "yes" })}
            className="size-4 accent-brand"
          />
          <span className="text-sm font-medium text-neutral-100">Yes</span>
        </label>
      </div>

      {state.answer === "yes" ? (
        <div className="mt-3 space-y-2 rounded-xl border border-white/15 bg-black/25 p-3">
          <p className="text-sm font-medium text-neutral-100">Select all that apply:</p>
          {ALLERGY_PRESET_OPTIONS.map((option) => {
            const checked = state.selected.includes(option);
            return (
              <label key={option} className="flex cursor-pointer items-center gap-2 text-sm text-neutral-100">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => {
                    const nextSelected = e.target.checked
                      ? [...state.selected, option]
                      : state.selected.filter((x) => x !== option);
                    sync({ ...state, selected: nextSelected });
                  }}
                  className="size-4 accent-brand"
                />
                {option}
              </label>
            );
          })}
          <div className="pt-1">
            <label htmlFor={`allergy-other-${field.id}`} className="text-sm font-medium text-neutral-100">
              Other
            </label>
            <textarea
              id={`allergy-other-${field.id}`}
              value={state.other}
              onChange={(e) => sync({ ...state, other: e.target.value })}
              rows={2}
              className={`${inputClass} mt-1 resize-y`}
              placeholder="Add any other allergy or medical notes"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

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
        <h2 className="text-lg font-bold text-neutral-100">{title}</h2>
        <p className="mt-0.5 text-sm text-neutral-200/85">{description}</p>
      </div>
    </div>
  );
}

function renderFieldInput(
  field: FormFieldDef,
  value: string,
  onChange: (v: string) => void,
  rules: PublicRegistrationFieldRules,
  opts?: { onBlur?: () => void; onBlurWithValue?: (value: string) => void },
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
    (field.key === "guardianPhone" && rules.requireGuardianPhone) ||
    (field.key === "allergiesNotes" && rules.requireAllergiesNotes);

  const inputId = `fld-${field.id}`;

  const commonLabel = (
    <label htmlFor={inputId} className={labelClass}>
      {field.label}
      {req ? <span className="text-red-600"> *</span> : <span className="font-normal text-neutral-500"> (optional)</span>}
    </label>
  );

  if (field.type === "textarea") {
    const allergiesHelper =
      field.key === "allergiesNotes" && rules.requireAllergiesNotes
        ? "Required for this program — you can enter “None” if not applicable."
        : field.helperText;
    if (field.key === "allergiesNotes") {
      return (
        <AllergiesFieldInput
          field={field}
          value={value}
          onChange={onChange}
          required={req}
          helperText={allergiesHelper ?? "Optional — helps teachers keep everyone safe."}
        />
      );
    }
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
        {allergiesHelper ? <p className={hintClass}>{allergiesHelper}</p> : null}
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
            <label key={o.value} className="flex cursor-pointer items-center gap-2 text-sm text-neutral-100">
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
        onBlur={(e) => {
          opts?.onBlur?.();
          opts?.onBlurWithValue?.(e.currentTarget.value);
        }}
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
  paymentCanceled = false,
  initialSeasonId,
}: {
  seasons: PublicSeasonOption[];
  /** Per page load — must match server action `submitPublicRegistration` idempotency check. */
  clientSubmitKey: string;
  paymentCanceled?: boolean;
  /** e.g. after Stripe Checkout cancel — pre-select season. */
  initialSeasonId?: string;
} & RegisterContactProps) {
  const [state, formAction, pending] = useActionState(submitPublicRegistration, initial);
  const [seasonId, setSeasonId] = useState(() => {
    const first = seasons[0]?.id ?? "";
    if (initialSeasonId && seasons.some((s) => s.id === initialSeasonId)) return initialSeasonId;
    return first;
  });
  const [step, setStep] = useState(0);
  const [guardian, setGuardian] = useState<Record<string, string>>({});
  const [children, setChildren] = useState<Array<{ id: string; values: Record<string, string> }>>([]);
  const [confirmAccurate, setConfirmAccurate] = useState(false);
  const [smsConsent, setSmsConsent] = useState(false);
  const [emailBlurred, setEmailBlurred] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [ageGateError, setAgeGateError] = useState<{ childIndex: number; message: string } | null>(null);
  /** Live age messages keyed by child index (set on DOB change/blur when date is complete). */
  const [liveDobAgeByChild, setLiveDobAgeByChild] = useState<Record<number, string>>({});
  const [coverProcessingFee, setCoverProcessingFee] = useState(false);

  const current = useMemo(() => seasons.find((s) => s.id === seasonId), [seasons, seasonId]);
  const def = current?.definition;
  const rules = current?.rules ?? defaultPublicFieldRules;

  const stripePayment = useMemo(() => {
    if (!current) return { active: false as const };
    const active = current.stripeCheckoutEnabled && (current.stripeAmountCents ?? 0) >= 50;
    if (!active) return { active: false as const };
    const baseCents = computeRegistrationBaseCents(
      current.stripePricingUnit,
      current.stripeAmountCents,
      children.length,
    );
    const includeFee = includeProcessingFeeForMode(current.stripeProcessingFeeMode, coverProcessingFee);
    const { totalCents, processingCents } = computeProcessingGrossUp(baseCents, includeFee);
    return {
      active: true as const,
      baseCents,
      totalCents,
      processingCents,
      includeFee,
      mode: current.stripeProcessingFeeMode,
      unit: current.stripePricingUnit,
      label: current.stripeProductLabel?.trim() || "VBS registration",
    };
  }, [current, children.length, coverProcessingFee]);

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

  const reviewChildDobFieldMessages = useMemo((): Record<number, string> | null => {
    const fe = state?.fieldErrors;
    if (!fe) return null;
    const map: Record<number, string> = {};
    for (const [k, msgs] of Object.entries(fe)) {
      const m = /^childDateOfBirth__(\d+)$/.exec(k);
      if (m && Array.isArray(msgs) && msgs[0]) map[Number(m[1])] = msgs[0];
    }
    return Object.keys(map).length > 0 ? map : null;
  }, [state?.fieldErrors]);

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
    setSmsConsent(false);
    setLocalError(null);
    setAgeGateError(null);
    setLiveDobAgeByChild({});
    setEmailBlurred(false);
    setCoverProcessingFee(false);
  }, [seasonId, def, childFieldKeys]);

  const applyLiveDobAgeCheck = useCallback(
    (childIndex: number, dobStr: string) => {
      if (!current) return;
      const msg = childAgeGateMessageForDob(dobStr, childIndex, current);
      setLiveDobAgeByChild((prev) => {
        const next = { ...prev };
        if (msg) next[childIndex] = msg;
        else delete next[childIndex];
        return next;
      });
      setAgeGateError((ag) => (ag?.childIndex === childIndex ? null : ag));
    },
    [current],
  );

  useEffect(() => {
    const url = state?.stripeCheckoutUrl;
    if (!url?.trim()) return;
    window.location.href = url;
  }, [state?.stripeCheckoutUrl]);

  useEffect(() => {
    const idx =
      ageGateError?.childIndex ??
      (() => {
        const keys = Object.keys(liveDobAgeByChild);
        if (keys.length === 0) return null;
        return Number(keys.sort((a, b) => Number(a) - Number(b))[0]);
      })();
    if (idx == null) return;
    const id = `child-dob-age-alert-${idx}`;
    const t = window.requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    return () => window.cancelAnimationFrame(t);
  }, [ageGateError, liveDobAgeByChild]);

  useEffect(() => {
    if (step !== 3 || !reviewChildDobFieldMessages) return;
    const firstKey = Object.keys(reviewChildDobFieldMessages).sort((a, b) => Number(a) - Number(b))[0];
    if (firstKey === undefined) return;
    const id = `review-child-dob-age-${firstKey}`;
    const t = window.requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    return () => window.cancelAnimationFrame(t);
  }, [step, reviewChildDobFieldMessages]);

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
        if (current) {
          for (let i = 0; i < children.length; i++) {
            const msg = childAgeGateMessageForDob(children[i].values.childDateOfBirth ?? "", i, current);
            if (msg) return msg;
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
        if (smsConsent && !(guardian.guardianPhone ?? "").trim()) {
          return "Please provide a phone number to receive SMS updates.";
        }
      }
      return null;
    },
    [
      def,
      guardianSections,
      childSections,
      consentSections,
      guardian,
      children,
      confirmAccurate,
      smsConsent,
      rules,
      current?.minimumParticipantAgeYears,
      current?.maximumParticipantAgeYears,
      current?.startDate,
    ],
  );

  const goNext = () => {
    const err = validateStep(step);
    if (!err) {
      setLocalError(null);
      setAgeGateError(null);
      if (step === 1) setLiveDobAgeByChild({});
      setStep((x) => Math.min(x + 1, TOTAL_STEPS - 1));
      return;
    }
    const ageGate = step === 1 ? parseChildAgeGateError(err) : null;
    if (ageGate) {
      setLocalError(null);
      setAgeGateError(ageGate);
      return;
    }
    setAgeGateError(null);
    setLocalError(err);
  };

  const goBack = () => {
    setLocalError(null);
    setAgeGateError(null);
    setLiveDobAgeByChild({});
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

  const redirectingToStripe = state?.ok === true && !!state.stripeCheckoutUrl?.trim();
  const success = state?.ok === true && !state.stripeCheckoutUrl?.trim();

  if (redirectingToStripe) {
    return (
      <div className="relative z-0 mx-auto max-w-lg sm:max-w-xl">
        <div className="rounded-2xl border border-brand/30 bg-white px-6 py-10 text-center shadow-lg dark:border-brand/40 dark:bg-neutral-950">
          <Sparkles className="mx-auto size-14 text-brand" aria-hidden />
          <p className="mt-4 text-lg font-semibold text-neutral-900 dark:text-neutral-50">Opening secure checkout</p>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">
            {state?.message || "You’ll complete card payment on Stripe’s site. If nothing happens, check your popup blocker or refresh this page."}
          </p>
        </div>
      </div>
    );
  }

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

  function renderWizardContent(season: PublicSeasonOption, formDef: FormDefinitionV1): React.ReactNode {
    return (
      <div className="rounded-3xl border border-white/10 bg-black/40 shadow-[0_20px_60px_rgba(0,0,0,0.45),0_0_48px_rgba(255,220,100,0.12)] backdrop-blur-xl">
        <div className="px-5 pt-6 text-center sm:px-8 lg:px-7 lg:pt-5">
          <RegistrationHeroBrand churchDisplayName={churchDisplayName} />
          <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-brand/90">{churchDisplayName}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl lg:text-[1.9rem]">
            {season.formTitle || season.name}
          </h1>
          <p className="mt-2 text-sm font-medium text-neutral-200/90 lg:mt-2 lg:text-sm">
            {formatEventRange(season.startDate, season.endDate)}
          </p>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-neutral-200/85 lg:mt-3 lg:text-sm">
            {season.welcomeMessage?.trim() ||
              `Please complete this form to register your ${children.length > 1 ? "children" : "child"} for VBS.`}
          </p>
        </div>

        {paymentCanceled ? (
          <div
            className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100"
            role="status"
          >
            <p className="font-semibold">Payment was not completed</p>
            <p className="mt-1 text-amber-900/90 dark:text-amber-100/90">
              Your registration details are still here — review the payment step and submit again when you’re ready. If
              you already paid, wait a moment for confirmation or contact the church office with your reference code.
            </p>
          </div>
        ) : null}

        <div className="mt-5 px-1 lg:mt-4">
          <div className="flex items-center justify-between text-xs font-medium text-neutral-300/90">
            <span>
              Step {step + 1} of {TOTAL_STEPS}
            </span>
            <span className="text-neutral-100">{STEP_LABELS[step]}</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/15">
            <div
              className="h-full rounded-full bg-brand transition-[width] duration-300 ease-out"
              style={{ width: `${((step + 1) / TOTAL_STEPS) * 100}%` }}
            />
          </div>
          <div className="mt-4 border-t border-white/10" />
        </div>

        <form action={formAction} className="space-y-6 px-6 pb-8 sm:px-9 lg:space-y-5 lg:px-7 lg:pb-6">
          <div className="pointer-events-none absolute -left-[10000px] h-0 w-0 overflow-hidden opacity-0">
            <label htmlFor="company">Company</label>
            <input type="text" id="company" name="company" tabIndex={-1} autoComplete="off" />
          </div>

          <input type="hidden" name="seasonId" value={seasonId} readOnly />
          <input type="hidden" name="__vbsSubmitNonce" value={clientSubmitKey} readOnly />
          <input type="hidden" name="childCount" value={children.length} readOnly />
          <input type="hidden" name="confirmedAccurate" value={confirmAccurate ? "true" : "false"} readOnly />
          <input type="hidden" name="smsConsent" value={smsConsent ? "true" : "false"} readOnly />
          {stripePayment.active && stripePayment.mode === "REQUIRED" ? (
            <input type="hidden" name="stripeCoverProcessingFee" value="true" readOnly />
          ) : null}

          {formDef.fields.map((f) => {
            const sec = formDef.sections.find((s) => s.id === f.sectionId);
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
          {state &&
            !state.ok &&
            hasFieldErrors(state) &&
            !(
              step === 3 &&
              state.fieldErrors &&
              Object.keys(state.fieldErrors).length > 0 &&
              Object.keys(state.fieldErrors).every((k) => /^childDateOfBirth__\d+$/.test(k))
            ) && (
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
                  {guardianSections.length > 1 ? (
                    <>
                      <h3 className="mb-3 text-sm font-bold text-white">{sec.title}</h3>
                      {sec.description ? <p className="mb-3 text-sm text-neutral-300/85">{sec.description}</p> : null}
                    </>
                  ) : null}
                  <div className="grid gap-4 sm:grid-cols-2">
                    {formDef.fields
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
                            {f.key === "guardianEmail" && showEmailError ? (
                              <p className={`${hintClass} text-red-600`}>Enter a valid email address.</p>
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
              {(() => {
                const minOk =
                  season.minimumParticipantAgeYears != null &&
                  season.minimumParticipantAgeYears >= 1;
                const maxOk =
                  season.maximumParticipantAgeYears != null &&
                  season.maximumParticipantAgeYears >= 1;
                if (!minOk && !maxOk) return null;
                const startLabel = new Date(season.startDate).toLocaleDateString(undefined, {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                });
                return (
                  <p className="mb-4 rounded-lg border border-white/15 bg-white/8 px-3 py-2 text-sm text-neutral-100/90">
                    {minOk && maxOk ? (
                      <>
                        Each child must be between{" "}
                        <span className="font-semibold">{season.minimumParticipantAgeYears}</span> and{" "}
                        <span className="font-semibold">{season.maximumParticipantAgeYears}</span> years old on{" "}
                        {startLabel} (first day of this VBS).
                      </>
                    ) : minOk ? (
                      <>
                        Each child must be at least{" "}
                        <span className="font-semibold">{season.minimumParticipantAgeYears}</span> years old on{" "}
                        {startLabel} (first day of this VBS).
                      </>
                    ) : (
                      <>
                        Each child must be at most{" "}
                        <span className="font-semibold">{season.maximumParticipantAgeYears}</span> years old on{" "}
                        {startLabel} (first day of this VBS).
                      </>
                    )}
                  </p>
                );
              })()}
              {children.map((ch, idx) => {
                const childShowsDob = childSections
                  .flatMap((sec) => formDef.fields.filter((field) => field.sectionId === sec.id))
                  .some(
                    (field) =>
                      field.key === "childDateOfBirth" &&
                      field.type !== "sectionHeader" &&
                      field.type !== "staticText" &&
                      visible(field, ch.values),
                  );
                const childDobFallbackMsg =
                  liveDobAgeByChild[idx] ?? (ageGateError?.childIndex === idx ? ageGateError.message : null);
                return (
                  <div
                    key={ch.id}
                    className="mb-4 rounded-xl border border-white/15 bg-black/30 p-4"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-sm font-bold text-brand">Child {idx + 1}</span>
                      {children.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            setAgeGateError(null);
                            setLiveDobAgeByChild({});
                            setChildren((r) => (r.length <= 1 ? r : r.filter((x) => x.id !== ch.id)));
                          }}
                          className="inline-flex items-center gap-1 text-xs font-medium text-red-700 dark:text-red-300"
                        >
                          <Trash2 className="size-3.5" aria-hidden />
                          Remove
                        </button>
                      )}
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {childSections.flatMap((sec) =>
                        formDef.fields
                          .filter((field) => field.sectionId === sec.id)
                          .map((field) => {
                            if (field.type === "sectionHeader" || field.type === "staticText") {
                              return (
                                <div key={field.id} className="sm:col-span-2">
                                  {renderFieldInput(field, "", () => {}, rules)}
                                </div>
                              );
                            }
                            if (!visible(field, ch.values)) return null;
                            const colSpan = field.type === "textarea" || field.type === "radio" ? "sm:col-span-2" : "";
                            const dobAgeMsg =
                              field.key === "childDateOfBirth"
                                ? liveDobAgeByChild[idx] ??
                                  (ageGateError?.childIndex === idx ? ageGateError.message : null)
                                : null;
                            const showAgeAlertHere =
                              field.key === "childDateOfBirth" && childShowsDob && dobAgeMsg;
                            return (
                              <Fragment key={field.id}>
                                <div className={colSpan}>
                                  {renderFieldInput(
                                    field,
                                    ch.values[field.key] ?? "",
                                    (v) => {
                                      setChildren((rows) =>
                                        rows.map((r) =>
                                          r.id === ch.id ? { ...r, values: { ...r.values, [field.key]: v } } : r,
                                        ),
                                      );
                                      if (field.key === "childDateOfBirth") {
                                        applyLiveDobAgeCheck(idx, v);
                                      }
                                    },
                                    rules,
                                    field.key === "childDateOfBirth"
                                      ? {
                                          onBlurWithValue: (dobVal) => applyLiveDobAgeCheck(idx, dobVal),
                                        }
                                      : undefined,
                                  )}
                                </div>
                                {showAgeAlertHere ? (
                                  <div
                                    id={`child-dob-age-alert-${idx}`}
                                    className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100 sm:col-span-2"
                                    role="alert"
                                  >
                                    <X className="mt-0.5 size-4 shrink-0" aria-hidden />
                                    <span>{dobAgeMsg}</span>
                                  </div>
                                ) : null}
                              </Fragment>
                            );
                          }),
                      )}
                    </div>
                    {!childShowsDob && childDobFallbackMsg ? (
                      <div
                        id={`child-dob-age-alert-${idx}`}
                        className="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100"
                        role="alert"
                      >
                        <X className="mt-0.5 size-4 shrink-0" aria-hidden />
                        <span>{childDobFallbackMsg}</span>
                      </div>
                    ) : null}
                  </div>
                );
              })}
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
                  {consentSections.length > 1 ? <h3 className="font-semibold text-neutral-100">{sec.title}</h3> : null}
                  {formDef.fields
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
                <div className="mt-5 rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm">
                  <p className="font-semibold">Questions?</p>
                  <p className="mt-1 text-neutral-200/90">
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
              <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-xl border border-white/15 bg-white/10 px-4 py-4">
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
              <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-xl border border-white/15 bg-white/10 px-4 py-4">
                <input
                  type="checkbox"
                  checked={smsConsent}
                  onChange={(e) => setSmsConsent(e.target.checked)}
                  className="mt-1 size-5 accent-brand"
                />
                <span className="text-sm">
                  I agree to receive SMS text messages on my provided phone number for VBS event updates and
                  announcements.
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
                      <li key={ch.id} className="rounded-lg border border-white/15 bg-black/20 p-2">
                        <span className="font-semibold">Child {i + 1}</span>
                        <ul className="mt-1 text-neutral-200/90">
                          {Object.entries(ch.values).map(([k, v]) =>
                            v ? (
                              <li key={k}>
                                {k}: {v}
                              </li>
                            ) : null,
                          )}
                        </ul>
                        {reviewChildDobFieldMessages?.[i] ? (
                          <div
                            id={`review-child-dob-age-${i}`}
                            className="mt-2 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100"
                            role="alert"
                          >
                            <X className="mt-0.5 size-4 shrink-0" aria-hidden />
                            <span>{reviewChildDobFieldMessages[i]}</span>
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase text-neutral-500">SMS updates</p>
                  <p className="mt-1 text-neutral-200/90">{smsConsent ? "Consented" : "Not consented"}</p>
                </div>
                {stripePayment.active ? (
                  <div className="mt-5 rounded-xl border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-600 dark:bg-neutral-900/60">
                    <p className="text-xs font-bold uppercase text-neutral-500">Card payment</p>
                    <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">{stripePayment.label}</p>
                    <dl className="mt-3 space-y-1 text-sm">
                      <div className="flex justify-between gap-4">
                        <dt className="text-neutral-600 dark:text-neutral-400">
                          {stripePayment.unit === "PER_CHILD"
                            ? `Program fee (${children.length} ${children.length === 1 ? "child" : "children"})`
                            : "Program fee"}
                        </dt>
                        <dd className="font-medium text-neutral-900 dark:text-neutral-50">
                          {formatUsdFromCents(stripePayment.baseCents)}
                        </dd>
                      </div>
                      {stripePayment.processingCents > 0 ? (
                        <div className="flex justify-between gap-4">
                          <dt className="text-neutral-600 dark:text-neutral-400">Card processing (est.)</dt>
                          <dd className="font-medium text-neutral-900 dark:text-neutral-50">
                            {formatUsdFromCents(stripePayment.processingCents)}
                          </dd>
                        </div>
                      ) : null}
                      <div className="flex justify-between gap-4 border-t border-neutral-200 pt-2 dark:border-neutral-600">
                        <dt className="font-semibold text-neutral-900 dark:text-neutral-100">Total due</dt>
                        <dd className="font-semibold text-neutral-900 dark:text-neutral-50">
                          {formatUsdFromCents(stripePayment.totalCents)}
                        </dd>
                      </div>
                    </dl>
                    <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
                      After you submit, you’ll be sent to a secure Stripe checkout page to pay by card. Estimated
                      processing fee uses typical US card pricing (2.9% + $0.30); actual Stripe fees may vary slightly.
                    </p>
                    {stripePayment.mode === "OPTIONAL" ? (
                      <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-lg border border-neutral-200 bg-white px-3 py-3 dark:border-neutral-600 dark:bg-neutral-950">
                        <input
                          type="checkbox"
                          name="stripeCoverProcessingFee"
                          value="true"
                          checked={coverProcessingFee}
                          onChange={(e) => setCoverProcessingFee(e.target.checked)}
                          className="mt-0.5 size-5 accent-brand"
                        />
                        <span className="text-sm text-neutral-800 dark:text-neutral-200">
                          Cover the estimated card processing fee (
                          {formatUsdFromCents(
                            computeProcessingGrossUp(stripePayment.baseCents, true).processingCents,
                          )}
                          ) so the program nets closer to the full registration amount after card fees.
                        </span>
                      </label>
                    ) : (
                      <p className="mt-3 text-sm font-medium text-neutral-800 dark:text-neutral-200">
                        This form includes the estimated card processing fee on every payment.
                      </p>
                    )}
                  </div>
                ) : null}
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
                  {pending
                    ? "Submitting…"
                    : stripePayment.active
                      ? "Submit & pay with card"
                      : "Submit registration"}
                </button>
              )}
            </div>
          </div>

          <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/12 bg-black/70 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-10px_28px_rgba(0,0,0,0.35)] backdrop-blur-xl md:hidden">
            <div className="mx-auto flex max-w-lg gap-2">
              {step > 0 ? (
                <button
                  type="button"
                  onClick={goBack}
                  className="inline-flex min-h-12 flex-1 items-center justify-center gap-1 rounded-xl border border-white/20 bg-white/10 text-sm font-semibold text-white"
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
                  {pending
                    ? "Submitting…"
                    : stripePayment.active
                      ? "Pay with card"
                      : "Submit"}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    );
  }

  const layout: PublicRegistrationLayout = current.backgroundLayout;
  const isSplit = layout === "SPLIT_FORM_LEFT" || layout === "SPLIT_FORM_RIGHT";
  const splitGridClass =
    layout === "SPLIT_FORM_LEFT"
      ? "grid grid-cols-1 gap-0 lg:grid-cols-[min(38rem,46vw)_1fr] lg:min-h-[calc(100dvh-8.5rem)] lg:items-stretch"
      : "grid grid-cols-1 gap-0 lg:grid-cols-[1fr_min(38rem,46vw)] lg:min-h-[calc(100dvh-8.5rem)] lg:items-stretch";

  return (
    <div
      className={
        isSplit
          ? "relative isolate mx-auto w-full max-w-none pb-28 md:pb-8"
          : "relative isolate pb-28 md:pb-8"
      }
    >
      {!isSplit ? (
        <RegistrationBackgroundMedia
          videoUrl={current.backgroundVideoUrl}
          imageUrl={current.backgroundImageUrl}
          dimmingPercent={current.backgroundDimmingPercent}
          variant="fixed"
        />
      ) : (
        <div className="lg:hidden">
          <RegistrationBackgroundMedia
            videoUrl={current.backgroundVideoUrl}
            imageUrl={current.backgroundImageUrl}
            dimmingPercent={current.backgroundDimmingPercent}
            variant="fixed"
          />
        </div>
      )}
      {isSplit ? (
        <div className={splitGridClass}>
          <div
            className={
              (layout === "SPLIT_FORM_LEFT"
                ? "order-2 lg:col-start-1 lg:row-start-1"
                : "order-2 lg:col-start-2 lg:row-start-1") +
              " relative z-10 flex w-full justify-center px-4 pt-6 pb-28 lg:border-l lg:border-stone-200/60 lg:bg-white/92 lg:shadow-[inset_1px_0_0_rgba(255,255,255,0.85)] lg:backdrop-blur-md lg:justify-center lg:px-6 lg:pb-5 lg:pt-7"
            }
          >
            <div className="relative w-full max-w-2xl">
              {renderWizardContent(current, def)}
            </div>
          </div>
          <div
            className={
              (layout === "SPLIT_FORM_LEFT"
                ? "order-1 lg:col-start-2 lg:row-start-1"
                : "order-1 lg:col-start-1 lg:row-start-1") +
              " relative hidden w-full overflow-hidden lg:block lg:min-h-full"
            }
          >
            <RegistrationBackgroundMedia
              videoUrl={current.backgroundVideoUrl}
              imageUrl={current.backgroundImageUrl}
              dimmingPercent={current.backgroundDimmingPercent}
              variant="split"
            />
            <div
              aria-hidden
              className={
                layout === "SPLIT_FORM_LEFT"
                  ? "pointer-events-none absolute inset-y-0 left-0 hidden w-20 bg-gradient-to-r from-white to-transparent lg:block"
                  : "pointer-events-none absolute inset-y-0 right-0 hidden w-20 bg-gradient-to-l from-white to-transparent lg:block"
              }
            />
          </div>
        </div>
      ) : (
        <div className="relative z-0 mx-auto max-w-lg sm:max-w-xl">
          {renderWizardContent(current, def)}
        </div>
      )}
    </div>
  );
}
