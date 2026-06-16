"use client";

import type React from "react";
import Link from "next/link";
import { Fragment, useActionState, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Mail,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import {
  defaultPublicFieldRules,
  type PublicRegistrationFieldRules,
} from "@/lib/public-registration";
import {
  formatParticipantAgeAsOfLabel,
  participantAgeYearsOnDate,
  resolveParticipantAgeRules,
  validateParticipantAge,
} from "@/lib/participant-age-gate";
import type { PortalBranding } from "@/lib/portal-branding";
import type { WaiverSupplementalFieldDef } from "@/lib/waiver-merge-fields";
import type { FormDefinitionV1, FormFieldDef, FormSectionDef } from "@/lib/registration-form-definition";
import { RESERVED_CHILD_KEYS, sectionHasFillableFields, sortSections } from "@/lib/registration-form-definition";
import { formatPhoneInput, phoneDigits } from "@/lib/phone-format";
import { parseLocalDate } from "@/lib/schemas/vbs-registration";
import {
  computeProcessingGrossUp,
  computeRegistrationBaseCents,
  formatUsdFromCents,
  includeProcessingFeeForMode,
  STRIPE_PER_CHILD_MAX_PAID_COUNT,
} from "@/lib/stripe-fee-math";
import { extractStripeSkipEvaluationData } from "@/lib/registration-form-validate";
import {
  fieldMatchesEmail,
  fieldMatchesPhone,
  formIncludesGuardianPhoneField,
  resolveGuardianContactFromForm,
} from "@/lib/registration-form-validate";
import { shouldSkipStripeForSubmission } from "@/lib/stripe-skip-rule";
import type { PublicRegistrationLayout } from "@/generated/prisma";
import { RegistrationBackgroundMedia } from "./registration-background-media";
import { RegistrationHeroBrand } from "./registration-hero-brand";
import { payLaterNoticeParagraphs, resolvePayLaterNotice } from "@/lib/pay-later";
import { isLegacyVbsPortal } from "@/lib/portal-public-path";
import { formatSeasonDateRange } from "@/lib/season-calendar-date";
import type { PublicRegistrationClosedDisplay } from "@/lib/public-registration-closed-display";
import { submitPublicRegistration, type PublicRegisterState } from "./actions";
import { RegistrationContactFooter } from "@/components/registration-contact-footer";
import {
  formatRegistrationDate,
  translateAllergyPreset,
  translateFieldForDisplay,
  translateParticipantLabel,
  translateSectionDescription,
  translateSectionTitle,
  translateServerMessage,
  translateStepLabel,
  translateWaiverDisplay,
  type RegistrationLocale,
} from "@/lib/registration-i18n";
import { resolveWaiverDisplayContent } from "@/lib/default-waiver-content";
import type { RegistrationMessageKey } from "@/lib/registration-i18n";
import { RegistrationLocaleProvider, useRegistrationLocale } from "./registration-locale-context";
import { RegistrationLanguageSwitcher } from "./registration-language-switcher";

/** Compact waiver flags/text per season — passed separately from `seasons` so RSC→client payload cannot drop them behind a large `definition`. */
export type PublicSeasonWaiverSnapshot = {
  enabled: boolean;
  title: string | null;
  description: string | null;
  body: string | null;
  mergeFieldKeys: string[];
  supplementalFields: WaiverSupplementalFieldDef[];
};

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
  participantAgeAsOfDateIso: string;
  participantSingularLabel: string;
  sessionPickerLabel: string;
  classroomsEnabled: boolean;
  stripeCheckoutEnabled: boolean;
  stripeAmountCents: number | null;
  stripePricingUnit: "PER_SUBMISSION" | "PER_CHILD";
  /** With per-child pricing: bill at most three children per submission (fourth+ free). */
  stripeCapPaidChildrenAtThree: boolean;
  stripePayLaterEnabled: boolean;
  stripePayLaterMessage: string | null;
  stripeProcessingFeeMode: "OPTIONAL" | "REQUIRED";
  stripeProductLabel: string | null;
  /** When set with {@link stripeSkipWhenFieldValue}, card checkout is skipped if any matching field equals (case-insensitive). */
  stripeSkipWhenFieldKey: string | null;
  stripeSkipWhenFieldValue: string | null;
  registrantLookupEnabled: boolean;
  /** Optional line under VBS dates on the wizard header (from public settings). */
  sessionTimeDescription: string | null;
  /** Optional per-season help email shown in public UI. */
  helpContactEmail: string | null;
  /** Custom thank-you / form footer; replaces auto Questions? line when set. */
  contactFooterText: string | null;
  lookupPath: string;
  publicRegistrationSlug: string | null;
  waiverEnabled: boolean;
  waiverTitle: string | null;
  waiverDescription: string | null;
  waiverBody: string | null;
  /** Field keys (from this form) copied onto each child’s signed waiver PDF. */
  waiverMergeFieldKeys: string[];
  /** Extra per-child prompts on the waiver step; answers are stored on the PDF. */
  waiverSupplementalFields: WaiverSupplementalFieldDef[];
};

export type RegisterContactProps = {
  contactEmail: string;
  contactPhone: string;
  churchDisplayName: string;
};

const initial: PublicRegisterState | null = null;

function defaultSignedAtLocal(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

type WaiverRowState = {
  signerName: string;
  signedAtIso: string;
  signatureDataUrl: string;
  accepted: boolean;
  supplemental: Record<string, string>;
};

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
  const trimmed = message.trim();
  const cutoffHit = /September\s+1,\s*2025/i.test(trimmed);
  if (!cutoffHit) return null;
  const withColon = /^Child (\d+):\s*(.+)$/i.exec(trimmed);
  if (withColon) {
    const n = Number.parseInt(withColon[1], 10);
    if (Number.isFinite(n) && n >= 1) return { childIndex: n - 1, message: trimmed };
  }
  const noColon = /^Child (\d+)\s+must be\s+(at least|at most)\s+/i.exec(trimmed);
  if (noColon) {
    const n = Number.parseInt(noColon[1], 10);
    if (Number.isFinite(n) && n >= 1) return { childIndex: n - 1, message: trimmed };
  }
  return null;
}

/** Returns the same message shape as step validation when DOB fails age rules; `null` if incomplete or OK. */
function childAgeGateMessageForDob(
  dobStr: string,
  childIndex: number,
  season: Pick<
    PublicSeasonOption,
    "minimumParticipantAgeYears" | "maximumParticipantAgeYears" | "participantAgeAsOfDateIso" | "participantSingularLabel"
  >,
): string | null {
  const trimmed = dobStr.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  let dob: Date;
  try {
    dob = parseLocalDate(trimmed);
  } catch {
    return null;
  }
  const asOfDate = parseLocalDate(season.participantAgeAsOfDateIso);
  const rules = resolveParticipantAgeRules({
    minimumParticipantAgeYears: season.minimumParticipantAgeYears,
    maximumParticipantAgeYears: season.maximumParticipantAgeYears,
    participantAgeAsOfDate: asOfDate,
  });
  return validateParticipantAge(dob, rules, season.participantSingularLabel, childIndex);
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

const TYPED_SIG_W = 560;
const TYPED_SIG_H = 160;

/** PNG data URL from typed signer name (matches server `PNG_SIG_RE` for waiver PDF). */
function typedSignaturePngDataUrl(name: string): string {
  const text = name.trim();
  if (!text || typeof document === "undefined") return "";
  const canvas = document.createElement("canvas");
  canvas.width = TYPED_SIG_W;
  canvas.height = TYPED_SIG_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, TYPED_SIG_W, TYPED_SIG_H);
  ctx.fillStyle = "#0f172a";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const maxW = TYPED_SIG_W - 40;
  let fontSize = 40;
  const applyFont = () => {
    ctx.font = `italic ${fontSize}px "Segoe Script", "Apple Chancery", "Brush Script MT", "Snell Roundhand", cursive, serif`;
  };
  applyFont();
  while (fontSize > 14 && ctx.measureText(text).width > maxW) {
    fontSize -= 2;
    applyFont();
  }
  ctx.fillText(text, TYPED_SIG_W / 2, TYPED_SIG_H / 2);
  return canvas.toDataURL("image/png");
}

type RegistrationUi = {
  locale: RegistrationLocale;
  t: (key: RegistrationMessageKey, params?: Record<string, string | number>) => string;
};

function TypedSignaturePreview({ dataUrl, ui }: { dataUrl: string; ui: RegistrationUi }) {
  if (!dataUrl.trim()) {
    return (
      <div className="flex min-h-[160px] items-center justify-center rounded-lg border border-dashed border-neutral-300/60 bg-white/90 px-4 text-center text-sm text-neutral-600">
        {ui.t("signaturePreview")}
      </div>
    );
  }
  return (
    <img
      src={dataUrl}
      alt=""
      width={TYPED_SIG_W}
      height={TYPED_SIG_H}
      className="mx-auto h-auto max-h-40 w-full max-w-full rounded-lg border border-neutral-200 bg-white object-contain"
    />
  );
}

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
  fieldInstanceKey,
  ui,
}: {
  field: FormFieldDef;
  value: string;
  onChange: (v: string) => void;
  required: boolean;
  helperText?: string;
  fieldInstanceKey?: string;
  ui: RegistrationUi;
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

  const scope = fieldInstanceKey ? `${field.id}-${fieldInstanceKey}` : field.id;

  return (
    <div>
      <p className={labelClass}>
        {field.label}
        {required ? (
          <span className="text-red-400"> *</span>
        ) : (
          <span className="font-normal text-neutral-400/90"> {ui.t("optional")}</span>
        )}
      </p>
      <p className={hintClass}>{helperText}</p>
      <div className="mt-2 space-y-2">
        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/15 bg-white/8 px-3 py-3">
          <input
            type="radio"
            name={`allergy-answer-${scope}`}
            checked={state.answer === "no"}
            onChange={() => sync({ answer: "no", selected: [], other: "" })}
            className="size-4 accent-brand"
          />
          <span className="text-sm font-medium text-neutral-100">{ui.t("allergyNo")}</span>
        </label>
        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/15 bg-white/8 px-3 py-3">
          <input
            type="radio"
            name={`allergy-answer-${scope}`}
            checked={state.answer === "yes"}
            onChange={() => sync({ ...state, answer: "yes" })}
            className="size-4 accent-brand"
          />
          <span className="text-sm font-medium text-neutral-100">{ui.t("allergyYes")}</span>
        </label>
      </div>

      {state.answer === "yes" ? (
        <div className="mt-3 space-y-2 rounded-xl border border-white/15 bg-black/25 p-3">
          <p className="text-sm font-medium text-neutral-100">{ui.t("allergySelectAll")}</p>
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
                {translateAllergyPreset(ui.locale, option)}
              </label>
            );
          })}
          <div className="pt-1">
            <label htmlFor={`allergy-other-${scope}`} className="text-sm font-medium text-neutral-100">
              {ui.t("allergyOther")}
            </label>
            <textarea
              id={`allergy-other-${scope}`}
              value={state.other}
              onChange={(e) => sync({ ...state, other: e.target.value })}
              rows={2}
              className={`${inputClass} mt-1 resize-y`}
              placeholder={ui.t("allergyOtherPlaceholder")}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function resolveSectionWizardKind(
  def: FormDefinitionV1,
  sec: FormSectionDef,
): "guardian" | "participants" | "consent" | null {
  if (!sectionHasFillableFields(def, sec.id)) return null;
  if (sec.audience === "guardian") return "guardian";
  if (sec.audience === "eachChild") return "participants";

  const fieldKeys = def.fields
    .filter(
      (f) => f.sectionId === sec.id && f.type !== "sectionHeader" && f.type !== "staticText",
    )
    .map((f) => f.key);
  if (fieldKeys.length === 0) return null;

  const childLikeCount = fieldKeys.filter(
    (k) => RESERVED_CHILD_KEYS.has(k) || k.startsWith("child"),
  ).length;
  if (childLikeCount > 0 && childLikeCount >= fieldKeys.length / 2) {
    return "participants";
  }

  if (sec.audience === "consent" || sec.audience === "static") return "consent";
  return null;
}

function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-lg font-bold text-neutral-100">{title}</h2>
      {description ? <p className="mt-0.5 text-sm text-neutral-200/85">{description}</p> : null}
    </div>
  );
}

function renderFieldInput(
  field: FormFieldDef,
  value: string,
  onChange: (v: string) => void,
  rules: PublicRegistrationFieldRules,
  opts?: { onBlur?: () => void; onBlurWithValue?: (value: string) => void; fieldInstanceKey?: string },
  ui?: RegistrationUi,
) {
  const displayField = ui ? translateFieldForDisplay(ui.locale, field) : field;

  if (field.type === "sectionHeader") {
    return <h3 className="mt-4 text-base font-bold text-neutral-100">{displayField.label}</h3>;
  }
  if (field.type === "staticText") {
    return (
      <div className="mt-2 rounded-lg bg-neutral-100 px-3 py-2 text-sm text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
        {displayField.helperText || displayField.label}
      </div>
    );
  }

  const req =
    field.required ||
    (field.key === "guardianEmail" && rules.requireGuardianEmail) ||
    (field.key === "guardianPhone" && rules.requireGuardianPhone) ||
    (field.key === "allergiesNotes" && rules.requireAllergiesNotes);

  const inputId = opts?.fieldInstanceKey ? `fld-${field.id}-${opts.fieldInstanceKey}` : `fld-${field.id}`;

  const commonLabel = (
    <label htmlFor={inputId} className={labelClass}>
      {displayField.label}
      {req ? (
        <span className="text-red-400"> *</span>
      ) : ui ? (
        <span className="font-normal text-neutral-400/90"> {ui.t("optional")}</span>
      ) : (
        <span className="font-normal text-neutral-400/90"> (optional)</span>
      )}
    </label>
  );

  if (field.type === "textarea") {
    const allergiesHelper =
      field.key === "allergiesNotes" && rules.requireAllergiesNotes
        ? ui?.locale === "es"
          ? "Obligatorio para este programa — puede escribir “Ninguna” si no aplica."
          : "Required for this program — you can enter “None” if not applicable."
        : displayField.helperText;
    if (field.key === "allergiesNotes" && ui) {
      return (
        <AllergiesFieldInput
          field={displayField}
          value={value}
          onChange={onChange}
          required={req}
          helperText={allergiesHelper ?? displayField.helperText}
          fieldInstanceKey={opts?.fieldInstanceKey}
          ui={ui}
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
          placeholder={displayField.placeholder}
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
          <option value="">{ui ? ui.t("chooseOption") : "Choose…"}</option>
          {displayField.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {displayField.helperText ? <p className={hintClass}>{displayField.helperText}</p> : null}
      </div>
    );
  }

  if (field.type === "radio" && field.options?.length) {
    return (
      <fieldset>
        <legend className={labelClass}>{displayField.label}</legend>
        <div className="mt-2 space-y-2">
          {displayField.options?.map((o) => (
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
        {displayField.helperText ? <p className={hintClass}>{displayField.helperText}</p> : null}
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
          <span className="font-semibold text-neutral-100">{displayField.label}</span>
          {displayField.helperText ? (
            <span className="mt-1 block text-sm text-neutral-300/90">{displayField.helperText}</span>
          ) : null}
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
        <span className="text-sm font-medium text-neutral-100">{displayField.label}</span>
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
        placeholder={displayField.placeholder}
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
      {displayField.helperText ? <p className={hintClass}>{displayField.helperText}</p> : null}
    </div>
  );
}

export function DynamicRegistrationWizard(props: {
  seasons: PublicSeasonOption[];
  waiverBySeasonId: Record<string, PublicSeasonWaiverSnapshot>;
  clientSubmitKey: string;
  paymentCanceled?: boolean;
  initialSeasonId?: string;
  registrationClosedDisplay?: PublicRegistrationClosedDisplay | null;
  portalBranding?: PortalBranding;
} & RegisterContactProps) {
  return (
    <RegistrationLocaleProvider>
      <DynamicRegistrationWizardInner {...props} />
    </RegistrationLocaleProvider>
  );
}

function DynamicRegistrationWizardInner({
  seasons,
  waiverBySeasonId,
  clientSubmitKey,
  contactEmail,
  contactPhone,
  churchDisplayName,
  portalBranding,
  paymentCanceled = false,
  initialSeasonId,
  registrationClosedDisplay = null,
}: {
  seasons: PublicSeasonOption[];
  /** Waiver settings keyed by season id (small payload; avoids losing `waiverEnabled` next to a large form definition). */
  waiverBySeasonId: Record<string, PublicSeasonWaiverSnapshot>;
  /** Per page load — must match server action `submitPublicRegistration` idempotency check. */
  clientSubmitKey: string;
  paymentCanceled?: boolean;
  /** e.g. after Stripe Checkout cancel — pre-select season. */
  initialSeasonId?: string;
  registrationClosedDisplay?: PublicRegistrationClosedDisplay | null;
  portalBranding?: PortalBranding;
} & RegisterContactProps) {
  const { locale, t } = useRegistrationLocale();
  const ui: RegistrationUi = useMemo(() => ({ locale, t }), [locale, t]);

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
  const [waiverPerChild, setWaiverPerChild] = useState<WaiverRowState[]>([]);
  const [emailBlurred, setEmailBlurred] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [ageGateError, setAgeGateError] = useState<{ childIndex: number; message: string } | null>(null);
  /** Live age messages keyed by child index (set on DOB change/blur when date is complete). */
  const [liveDobAgeByChild, setLiveDobAgeByChild] = useState<Record<number, string>>({});
  const [coverProcessingFee, setCoverProcessingFee] = useState(false);
  const [paymentChoice, setPaymentChoice] = useState<"card" | "pay_later">("card");
  /** Single native submit control so Enter / mobile browsers cannot activate a hidden duplicate submit. */
  const nativeSubmitRef = useRef<HTMLButtonElement>(null);

  /** Skip the old “Ready for payment” interstitial — go straight to Stripe Checkout. */
  useEffect(() => {
    const url = state?.stripeCheckoutUrl?.trim();
    if (state?.ok === true && url) {
      window.location.assign(url);
    }
  }, [state?.ok, state?.stripeCheckoutUrl]);

  const current = useMemo(() => seasons.find((s) => s.id === seasonId), [seasons, seasonId]);
  const def = current?.definition;
  const rules = current?.rules ?? defaultPublicFieldRules;
  const effectiveContactEmail = (current?.helpContactEmail?.trim() || contactEmail?.trim() || "") || "";
  const effectiveContactFooterText =
    current?.contactFooterText?.trim() || portalBranding?.contactFooterText?.trim() || null;
  const participantAgeRules = useMemo(() => {
    if (!current) return resolveParticipantAgeRules({});
    return resolveParticipantAgeRules({
      minimumParticipantAgeYears: current.minimumParticipantAgeYears,
      maximumParticipantAgeYears: current.maximumParticipantAgeYears,
      participantAgeAsOfDate: parseLocalDate(current.participantAgeAsOfDateIso),
    });
  }, [current]);
  const participantLabelRaw = current?.participantSingularLabel ?? portalBranding?.participantSingularLabel ?? "Child";
  const participantLabel = translateParticipantLabel(locale, participantLabelRaw);
  const sessionPickerLabel = current?.sessionPickerLabel ?? portalBranding?.sessionPickerLabel ?? "Session";
  const teamReviewNote = portalBranding?.teamReviewNote ?? t("teamReviewNote");

  const waiverSnap = useMemo((): PublicSeasonWaiverSnapshot | null => {
    const fromMap = waiverBySeasonId[seasonId];
    if (fromMap) return fromMap;
    const c = seasons.find((s) => s.id === seasonId);
    if (!c) return null;
    return {
      enabled: c.waiverEnabled === true,
      title: c.waiverTitle,
      description: c.waiverDescription,
      body: c.waiverBody,
      mergeFieldKeys: c.waiverMergeFieldKeys ?? [],
      supplementalFields: c.waiverSupplementalFields ?? [],
    };
  }, [waiverBySeasonId, seasonId, seasons]);

  const waiverDisplay = useMemo(() => {
    if (!waiverSnap?.enabled) return null;
    const resolved = resolveWaiverDisplayContent({
      title: waiverSnap.title,
      description: waiverSnap.description,
      body: waiverSnap.body,
    });
    return translateWaiverDisplay(locale, resolved);
  }, [waiverSnap, locale]);

  const waiverSupplementalSig = useMemo(
    () => JSON.stringify(waiverSnap?.supplementalFields ?? []),
    [waiverSnap?.supplementalFields],
  );

  const stripeFeeConfigured = useMemo(() => {
    if (!current) return false;
    return current.stripeCheckoutEnabled && (current.stripeAmountCents ?? 0) >= 50;
  }, [current]);

  const stripeSkippedByRule = useMemo(() => {
    if (!current || !def || !stripeFeeConfigured) return false;
    const snap = extractStripeSkipEvaluationData(
      def,
      guardian,
      children.map((c) => c.values),
    );
    return shouldSkipStripeForSubmission({
      skipFieldKey: current.stripeSkipWhenFieldKey,
      skipFieldValue: current.stripeSkipWhenFieldValue,
      ...snap,
    });
  }, [current, def, stripeFeeConfigured, guardian, children]);

  const payLaterAvailable = useMemo(() => {
    if (!current) return false;
    return (
      current.stripeCheckoutEnabled &&
      (current.stripeAmountCents ?? 0) >= 50 &&
      current.stripePayLaterEnabled &&
      !stripeSkippedByRule
    );
  }, [current, stripeSkippedByRule]);

  const isLegacyVbs = current ? isLegacyVbsPortal(current) : false;

  const payLaterNoticeText = useMemo(() => {
    if (!current || !payLaterAvailable) return "";
    return resolvePayLaterNotice(
      { name: current.name, startDate: new Date(current.startDate) },
      current.stripePayLaterMessage,
    );
  }, [current, payLaterAvailable]);

  const payLaterParagraphs = useMemo(
    () => payLaterNoticeParagraphs(payLaterNoticeText),
    [payLaterNoticeText],
  );

  const stripePayment = useMemo(() => {
    if (!current) return { active: false as const };
    const active = current.stripeCheckoutEnabled && (current.stripeAmountCents ?? 0) >= 50;
    if (!active) return { active: false as const };
    if (stripeSkippedByRule) return { active: false as const };
    if (payLaterAvailable && paymentChoice === "pay_later") return { active: false as const };
    const baseCents = computeRegistrationBaseCents(
      current.stripePricingUnit,
      current.stripeAmountCents,
      children.length,
      current.stripeCapPaidChildrenAtThree,
    );
    const includeFee = includeProcessingFeeForMode(current.stripeProcessingFeeMode, coverProcessingFee);
    const { totalCents, processingCents } = computeProcessingGrossUp(baseCents, includeFee);
    const childCount = children.length;
    const billableChildren =
      current.stripePricingUnit === "PER_CHILD" && current.stripeCapPaidChildrenAtThree
        ? Math.min(Math.max(1, childCount), STRIPE_PER_CHILD_MAX_PAID_COUNT)
        : childCount;
    return {
      active: true as const,
      baseCents,
      totalCents,
      processingCents,
      includeFee,
      mode: current.stripeProcessingFeeMode,
      unit: current.stripePricingUnit,
      capPaidChildrenAtThree: current.stripeCapPaidChildrenAtThree,
      billableChildren,
      childCount,
      label: current.stripeProductLabel?.trim() || "VBS registration",
    };
  }, [current, children.length, coverProcessingFee, stripeSkippedByRule, payLaterAvailable, paymentChoice]);

  /** When true, waiver signatures live on their own step so Privacy → Review cannot skip them. */
  const waiverStepActive = waiverSnap?.enabled === true;

  const guardianSections = useMemo(() => {
    if (!def) return [];
    return sortSections(def).filter((s) => resolveSectionWizardKind(def, s) === "guardian");
  }, [def]);

  const childSections = useMemo(() => {
    if (!def) return [];
    return sortSections(def).filter((s) => resolveSectionWizardKind(def, s) === "participants");
  }, [def]);

  const consentSections = useMemo(() => {
    if (!def) return [];
    return sortSections(def).filter((s) => resolveSectionWizardKind(def, s) === "consent");
  }, [def]);

  const childFieldKeys = useMemo(() => {
    if (!def) return [] as string[];
    const ids = new Set(childSections.map((s) => s.id));
    return def.fields
      .filter((f) => ids.has(f.sectionId) && f.type !== "sectionHeader" && f.type !== "staticText")
      .map((f) => f.key);
  }, [def, childSections]);

  const hasParticipantStep = childSections.length > 0 && childFieldKeys.length > 0;
  const hasConsentFormFields = useMemo(() => consentSections.length > 0, [consentSections]);

  type WizardFormStep = {
    kind: "guardian" | "participants" | "consent";
    sectionIds: string[];
    label: string;
  };
  type WizardStepDef =
    | WizardFormStep
    | { kind: "waiver"; label: string }
    | { kind: "review"; label: string };

  const activeSteps = useMemo((): WizardStepDef[] => {
    if (!def) return [{ kind: "review", label: t("review") }];
    const steps: WizardStepDef[] = [];
    const defaultLabels = {
      guardian: portalBranding?.contactSectionLabel ?? t("yourInformation"),
      participants: portalBranding?.participantSectionLabel ?? t("participants"),
      consent: t("privacy"),
    };

    for (const sec of sortSections(def)) {
      const kind = resolveSectionWizardKind(def, sec);
      if (!kind) continue;

      const label = translateStepLabel(
        locale,
        translateSectionTitle(locale, sec.title?.trim() || defaultLabels[kind]),
      );
      const last = steps[steps.length - 1];
      if (last && "sectionIds" in last && last.kind === kind) {
        last.sectionIds.push(sec.id);
      } else {
        steps.push({ kind, sectionIds: [sec.id], label });
      }
    }

    if (waiverStepActive) {
      steps.push({ kind: "waiver", label: waiverDisplay?.title?.trim() || t("waiver") });
    }
    steps.push({ kind: "review", label: t("review") });
    return steps;
  }, [def, portalBranding?.contactSectionLabel, portalBranding?.participantSectionLabel, waiverStepActive, waiverDisplay?.title, locale, t]);

  const stepLabels = useMemo(() => activeSteps.map((s) => s.label), [activeSteps]);
  const totalSteps = activeSteps.length;
  const reviewStepIndex = useMemo(
    () => Math.max(0, activeSteps.findIndex((s) => s.kind === "review")),
    [activeSteps],
  );
  const currentStep = activeSteps[step];
  const currentStepKind = currentStep?.kind ?? "review";
  const eventName = current?.name ?? "this event";

  const currentStepFormSections = useMemo(() => {
    if (!def || !currentStep || !("sectionIds" in currentStep)) return [];
    const ids = new Set(currentStep.sectionIds);
    return sortSections(def).filter((sec) => ids.has(sec.id));
  }, [def, currentStep]);

  const isLastParticipantStep = useMemo(() => {
    let lastIndex = -1;
    activeSteps.forEach((s, i) => {
      if (s.kind === "participants") lastIndex = i;
    });
    return lastIndex >= 0 && step === lastIndex;
  }, [activeSteps, step]);

  const currentStepShowsAgeGate = useMemo(() => {
    if (currentStepKind !== "participants" || !def) return false;
    const ids = new Set(currentStepFormSections.map((s) => s.id));
    return def.fields.some(
      (f) => ids.has(f.sectionId) && f.key === "childDateOfBirth" && f.type !== "sectionHeader" && f.type !== "staticText",
    );
  }, [currentStepKind, def, currentStepFormSections]);

  const reviewContactLabel =
    translateSectionTitle(locale, guardianSections[0]?.title ?? portalBranding?.contactSectionLabel ?? t("contactInformation"));
  const reviewParticipantLabel =
    translateSectionTitle(locale, childSections[0]?.title ?? portalBranding?.participantSectionLabel ?? t("participants"));

  const childRowIds = useMemo(() => children.map((c) => c.id).join(","), [children]);

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
    setChildren(
      childFieldKeys.length > 0
        ? [{ id: newChildId(), values: Object.fromEntries(childFieldKeys.map((k) => [k, ""])) }]
        : [],
    );
    setStep(0);
    setConfirmAccurate(false);
    setSmsConsent(false);
    setWaiverPerChild([]);
    setLocalError(null);
    setAgeGateError(null);
    setLiveDobAgeByChild({});
    setEmailBlurred(false);
    setCoverProcessingFee(false);
  }, [seasonId, def, childFieldKeys]);

  useEffect(() => {
    if (!waiverSnap?.enabled || !def) {
      setWaiverPerChild([]);
      return;
    }
    const defs = waiverSnap.supplementalFields ?? [];
    const emptySupp = () => Object.fromEntries(defs.map((d) => [d.key, ""]));
    const gName = `${guardian.guardianFirstName ?? ""} ${guardian.guardianLastName ?? ""}`.trim();
    setWaiverPerChild((prev) =>
      children.map((_, idx) => {
        const p = prev[idx];
        const baseSupp = emptySupp();
        if (p) {
          return {
            ...p,
            supplemental: { ...baseSupp, ...p.supplemental },
            signatureDataUrl: typedSignaturePngDataUrl(p.signerName),
          };
        }
        return {
          signerName: gName,
          signedAtIso: defaultSignedAtLocal(),
          signatureDataUrl: typedSignaturePngDataUrl(gName),
          accepted: false,
          supplemental: baseSupp,
        };
      }),
    );
  }, [
    waiverSnap?.enabled,
    waiverSupplementalSig,
    children.length,
    childRowIds,
    def,
    guardian.guardianFirstName,
    guardian.guardianLastName,
  ]);

  const applyLiveDobAgeCheck = useCallback(
    (childIndex: number, dobStr: string) => {
      if (!current) return;
      const msg = childAgeGateMessageForDob(dobStr, childIndex, current);
      const displayMsg = msg ? translateServerMessage(locale, msg) : null;
      setLiveDobAgeByChild((prev) => {
        const next = { ...prev };
        if (displayMsg) next[childIndex] = displayMsg;
        else delete next[childIndex];
        return next;
      });
      setAgeGateError((ag) => (ag?.childIndex === childIndex ? null : ag));
    },
    [current, locale],
  );

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
    if (step !== reviewStepIndex || !reviewChildDobFieldMessages) return;
    const firstKey = Object.keys(reviewChildDobFieldMessages).sort((a, b) => Number(a) - Number(b))[0];
    if (firstKey === undefined) return;
    const id = `review-child-dob-age-${firstKey}`;
    const t = window.requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    return () => window.cancelAnimationFrame(t);
  }, [step, reviewStepIndex, reviewChildDobFieldMessages]);

  const validateStep = useCallback(
    (s: number): string | null => {
      if (!def) return t("formNotLoaded");
      const stepDef = activeSteps[s];
      const kind = stepDef?.kind;
      const stepSectionIds =
        stepDef && "sectionIds" in stepDef ? new Set(stepDef.sectionIds) : null;
      const fieldLabel = (f: FormFieldDef) => translateFieldForDisplay(locale, f).label;
      if (kind === "guardian" && stepSectionIds) {
        for (const sec of guardianSections.filter((x) => stepSectionIds.has(x.id))) {
          for (const f of def.fields.filter((x) => x.sectionId === sec.id)) {
            if (f.type === "sectionHeader" || f.type === "staticText") continue;
            if (!visible(f, guardian)) continue;
            const v = guardian[f.key] ?? "";
            const req =
              f.required ||
              (f.key === "guardianEmail" && rules.requireGuardianEmail) ||
              (fieldMatchesEmail(f) && rules.requireGuardianEmail) ||
              (f.key === "guardianPhone" && rules.requireGuardianPhone) ||
              (fieldMatchesPhone(f) && rules.requireGuardianPhone);
            if (req && (f.type === "checkbox" || f.type === "boolean") && v !== "true") {
              return t("fieldRequired", { label: fieldLabel(f) });
            }
            if (req && f.type !== "checkbox" && f.type !== "boolean" && !v.trim()) {
              return t("fieldRequired", { label: fieldLabel(f) });
            }
            if ((f.key === "guardianEmail" || fieldMatchesEmail(f)) && v.trim() && !emailLooksValid(v)) {
              return t("validEmailRequired");
            }
            if ((f.key === "guardianPhone" || fieldMatchesPhone(f)) && rules.requireGuardianPhone && !phoneDigits(v)) {
              return t("phoneRequired");
            }
          }
        }
      }
      if (kind === "participants" && stepSectionIds) {
        for (let i = 0; i < children.length; i++) {
          const row = children[i].values;
          for (const sec of childSections.filter((x) => stepSectionIds.has(x.id))) {
            for (const f of def.fields.filter((x) => x.sectionId === sec.id)) {
              if (f.type === "sectionHeader" || f.type === "staticText") continue;
              if (!visible(f, row)) continue;
              const v = row[f.key] ?? "";
              const req =
                f.required || (f.key === "allergiesNotes" && rules.requireAllergiesNotes);
              if (req && (f.type === "checkbox" || f.type === "boolean") && v !== "true") {
                return t("participantFieldRequired", {
                  participant: participantLabel,
                  index: i + 1,
                  label: fieldLabel(f),
                });
              }
              if (req && f.type !== "checkbox" && f.type !== "boolean" && !v.trim()) {
                return t("participantFieldRequired", {
                  participant: participantLabel,
                  index: i + 1,
                  label: fieldLabel(f),
                });
              }
            }
          }
        }
        if (current && stepSectionIds) {
          const stepHasDob = def.fields.some(
            (f) =>
              stepSectionIds.has(f.sectionId) &&
              f.key === "childDateOfBirth" &&
              f.type !== "sectionHeader" &&
              f.type !== "staticText",
          );
          if (stepHasDob) {
            for (let i = 0; i < children.length; i++) {
              const msg = childAgeGateMessageForDob(children[i].values.childDateOfBirth ?? "", i, current);
              if (msg) return translateServerMessage(locale, msg);
            }
          }
        }
      }
      if (kind === "consent" && stepSectionIds) {
        for (const sec of consentSections.filter((x) => stepSectionIds.has(x.id))) {
          for (const f of def.fields.filter((x) => x.sectionId === sec.id)) {
            if (f.type === "sectionHeader" || f.type === "staticText") continue;
            if (!visible(f, guardian)) continue;
            const v = guardian[f.key] ?? "";
            const req =
              f.required ||
              (f.key === "guardianEmail" && rules.requireGuardianEmail) ||
              (fieldMatchesEmail(f) && rules.requireGuardianEmail) ||
              (f.key === "guardianPhone" && rules.requireGuardianPhone) ||
              (fieldMatchesPhone(f) && rules.requireGuardianPhone);
            if (req && (f.type === "checkbox" || f.type === "boolean") && v !== "true") {
              return t("fieldRequired", { label: fieldLabel(f) });
            }
            if (req && f.type !== "checkbox" && f.type !== "boolean" && !v.trim()) {
              return t("fieldRequired", { label: fieldLabel(f) });
            }
            if (f.key === "guardianEmail" && v.trim() && !emailLooksValid(v)) {
              return t("validEmailRequired");
            }
          }
        }
        return null;
      }
      if (kind === "waiver") {
        if (waiverPerChild.length !== children.length) {
          return t("waiverLoading");
        }
        const waiverChildLabel = (i: number) => {
          const row = children[i]?.values;
          const n = `${row?.childFirstName ?? ""} ${row?.childLastName ?? ""}`.trim();
          return n || `${participantLabel} ${i + 1}`;
        };
        const defs = waiverSnap?.supplementalFields ?? [];
        for (let i = 0; i < children.length; i++) {
          const label = waiverChildLabel(i);
          const w = waiverPerChild[i];
          if (!w) return t("waiverComplete", { label });
          if (!w.signerName.trim()) return t("waiverSignerName", { label });
          if (!w.signedAtIso.trim()) return t("waiverSignedAt", { label });
          if (!w.signatureDataUrl.trim()) return t("waiverSignature", { label });
          if (!w.accepted) return t("waiverAccept", { label });
          for (const d of defs) {
            if (d.required && !(w.supplemental[d.key] ?? "").trim()) {
              return t("waiverFieldRequired", { label, field: d.label });
            }
          }
        }
        return null;
      }
      if (kind === "review") {
        if (!confirmAccurate) return t("confirmAccurateRequired");
        const resolvedGuardian = def ? resolveGuardianContactFromForm(def, guardian) : null;
        if (
          smsConsent &&
          def &&
          formIncludesGuardianPhoneField(def) &&
          !(resolvedGuardian?.guardianPhone ?? "").trim()
        ) {
          return t("phoneSmsRequired");
        }
        if (payLaterAvailable && paymentChoice !== "card" && paymentChoice !== "pay_later") {
          return t("choosePayment");
        }
        return null;
      }
      return null;
    },
    [
      def,
      activeSteps,
      guardianSections,
      childSections,
      consentSections,
      guardian,
      children,
      confirmAccurate,
      smsConsent,
      waiverPerChild,
      rules,
      waiverSnap,
      payLaterAvailable,
      paymentChoice,
      current,
      participantLabel,
      locale,
      t,
    ],
  );

  const primarySubmitLabel = useMemo(() => {
    if (pending) return t("submitting");
    if (payLaterAvailable && paymentChoice === "pay_later") return t("submitRegistration");
    if (stripePayment.active) return t("submitPayCard");
    if (stripeFeeConfigured && stripeSkippedByRule) return t("submit");
    return t("submitRegistration");
  }, [pending, payLaterAvailable, paymentChoice, stripePayment.active, stripeFeeConfigured, stripeSkippedByRule, t]);

  const mobileSubmitLabel = useMemo(() => {
    if (pending) return t("submitting");
    if (payLaterAvailable && paymentChoice === "pay_later") return t("submit");
    if (stripePayment.active) return t("payWithCard");
    return t("submit");
  }, [pending, payLaterAvailable, paymentChoice, stripePayment.active, t]);

  const goNext = () => {
    const err = validateStep(step);
    if (!err) {
      setLocalError(null);
      setAgeGateError(null);
      if (activeSteps[step]?.kind === "participants") setLiveDobAgeByChild({});
      setStep((x) => Math.min(x + 1, totalSteps - 1));
      return;
    }
    const ageGate = activeSteps[step]?.kind === "participants" ? parseChildAgeGateError(err) : null;
    if (ageGate) {
      setLocalError(null);
      setAgeGateError({ ...ageGate, message: translateServerMessage(locale, ageGate.message) });
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
    const headline = registrationClosedDisplay?.headline ?? t("registrationClosed");
    const detail =
      registrationClosedDisplay?.message ??
      `Please contact ${churchDisplayName}${contactPhone ? ` at ${contactPhone}` : ""}${contactEmail ? ` or ${contactEmail}` : ""}.`;

    return (
      <div className="relative z-0 mx-auto max-w-lg sm:max-w-xl">
        <div className="relative rounded-3xl border border-white/10 bg-black/40 px-6 py-10 text-center shadow-[0_20px_60px_rgba(0,0,0,0.45),0_0_48px_rgba(255,220,100,0.12)] backdrop-blur-xl sm:px-8">
          <div className="absolute right-4 top-4 z-10">
            <RegistrationLanguageSwitcher />
          </div>
          <RegistrationHeroBrand churchDisplayName={churchDisplayName} />
          <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-brand/90">{churchDisplayName}</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">{headline}</h1>
          <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-neutral-200/90">{detail}</p>
          {registrationClosedDisplay?.registrantLookupEnabled ? (
            <div className="mx-auto mt-6 max-w-md">
              <Link
                href="/register/lookup"
                className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/30 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:border-white/45 hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
              >
                <Search className="size-4 shrink-0" aria-hidden />
                {t("lookUpRegistration")}
              </Link>
            </div>
          ) : null}
          <RegistrationContactFooter
            contactFooterText={effectiveContactFooterText}
            contactEmail={contactEmail}
            contactPhone={contactPhone}
            churchDisplayName={churchDisplayName}
            className="mx-auto mt-6 max-w-md text-xs text-neutral-300/90"
            linkClassName="font-medium text-cyan-100 underline"
          />
        </div>
      </div>
    );
  }

  const success = state?.ok === true && !state.stripeCheckoutUrl?.trim();

  if (success) {
    return (
      <div className="relative z-0 mx-auto max-w-lg sm:max-w-xl">
        <div className="relative rounded-2xl border border-emerald-200 bg-white px-6 py-10 text-center shadow-lg dark:border-emerald-900/50 dark:bg-neutral-950">
          <div className="absolute right-4 top-4 z-10">
            <RegistrationLanguageSwitcher className="border-neutral-200 bg-neutral-100/90 text-neutral-800 [&_button]:text-neutral-700 [&_button[aria-pressed=true]]:bg-white [&_button[aria-pressed=true]]:text-neutral-900" />
          </div>
          <CheckCircle2 className="mx-auto size-14 text-emerald-600 dark:text-emerald-400" aria-hidden />
          <p className="mt-4 text-lg font-semibold text-neutral-900 dark:text-neutral-50">{t("allSet")}</p>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">
            {state?.message ? translateServerMessage(locale, state.message) : ""}
          </p>
          {state?.paymentSkippedAwaitingTeamReview ? (
            <p className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-50 px-4 py-3 text-left text-sm leading-relaxed text-emerald-950 dark:border-emerald-500/25 dark:bg-emerald-950/40 dark:text-emerald-50/95">
              {teamReviewNote}
            </p>
          ) : null}
          {state?.payLaterSubmitted && state.payLaterNotice ? (
            <div className="mt-4 space-y-3 rounded-xl border border-amber-500/35 bg-amber-50 px-4 py-3 text-left text-sm leading-relaxed text-amber-950 dark:border-amber-500/25 dark:bg-amber-950/40 dark:text-amber-100">
              <p className="font-semibold">{t("payLaterHeading")}</p>
              {payLaterNoticeParagraphs(state.payLaterNotice).map((para) => (
                <p key={para.slice(0, 48)}>{para}</p>
              ))}
              <p className="text-xs text-amber-900/80 dark:text-amber-200/80">
                {t("payLaterEmailNote")}
              </p>
            </div>
          ) : null}
          <RegistrationContactFooter
            contactFooterText={effectiveContactFooterText}
            contactEmail={effectiveContactEmail}
            contactPhone={contactPhone}
            churchDisplayName={churchDisplayName}
            className="mt-6 text-xs text-neutral-500"
          />
        </div>
      </div>
    );
  }

  function renderWizardContent(season: PublicSeasonOption, formDef: FormDefinitionV1): React.ReactNode {
    return (
      <div className="relative rounded-3xl border border-white/10 bg-black/40 shadow-[0_20px_60px_rgba(0,0,0,0.45),0_0_48px_rgba(255,220,100,0.12)] backdrop-blur-xl">
        <div className="absolute right-4 top-4 z-10 sm:right-5 sm:top-5">
          <RegistrationLanguageSwitcher />
        </div>
        <div className="px-5 pt-6 text-center sm:px-8 lg:px-7 lg:pt-5">
          <RegistrationHeroBrand churchDisplayName={churchDisplayName} />
          <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-brand/90">{churchDisplayName}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl lg:text-[1.9rem]">
            {season.formTitle || season.name}
          </h1>
          <div className="mx-auto mt-4 max-w-md space-y-1.5 text-center" role="group" aria-label="VBS dates and times">
            <p className="flex flex-wrap items-center justify-center gap-2 text-lg font-bold leading-snug text-white sm:text-xl">
              <CalendarDays className="size-4 shrink-0 text-amber-200/90" aria-hidden />
              <span>{formatSeasonDateRange(season.startDate, season.endDate)}</span>
            </p>
            {season.sessionTimeDescription?.trim() ? (
              <p className="flex items-start justify-center gap-2 text-sm font-semibold leading-snug text-white/95">
                <Clock className="mt-0.5 size-3.5 shrink-0 text-cyan-200/95" aria-hidden />
                <span className="max-w-[min(100%,22rem)] whitespace-pre-line text-left">
                  {season.sessionTimeDescription.trim()}
                </span>
              </p>
            ) : null}
          </div>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-neutral-200/85 lg:mt-3 lg:text-sm">
            {season.welcomeMessage?.trim() || t("welcomeFallback", { eventName: season.name })}
          </p>
          {effectiveContactEmail ? (
            <p className="mx-auto mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-100/95">
              <Mail className="size-3.5 shrink-0" aria-hidden />
              <a href={`mailto:${effectiveContactEmail}`} className="underline decoration-cyan-100/50 underline-offset-2">
                {effectiveContactEmail}
              </a>
            </p>
          ) : null}
          {season.registrantLookupEnabled ? (
            <div className="mx-auto mt-4 max-w-md px-1">
              <Link
                href={season.lookupPath ?? "/register/lookup"}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/30 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:border-white/45 hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
              >
                <Search className="size-4 shrink-0" aria-hidden />
                {t("alreadyRegistered")}
              </Link>
            </div>
          ) : null}
        </div>

        {paymentCanceled ? (
          <div
            className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100"
            role="status"
          >
            <p className="font-semibold">{t("paymentNotCompleted")}</p>
            <p className="mt-1 text-amber-900/90 dark:text-amber-100/90">{t("paymentNotCompletedDetail")}</p>
          </div>
        ) : null}

        <div className="mt-5 px-1 lg:mt-4">
          <div className="flex items-center justify-between text-xs font-medium text-neutral-300/90">
            <span>
              {t("stepOf", { current: step + 1, total: totalSteps })}
            </span>
            <span className="text-neutral-100">{stepLabels[step] ?? ""}</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/15">
            <div
              className="h-full rounded-full bg-brand transition-[width] duration-300 ease-out"
              style={{ width: `${((step + 1) / totalSteps) * 100}%` }}
            />
          </div>
          <div className="mt-4 border-t border-white/10" />
        </div>

        <form
          action={formAction}
          className="space-y-6 px-6 pb-8 sm:px-9 lg:space-y-5 lg:px-7 lg:pb-6"
          onSubmit={(e) => {
            if (step !== reviewStepIndex) {
              e.preventDefault();
            }
          }}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            if (step === reviewStepIndex) return;
            const t = e.target as HTMLElement;
            if (t.tagName === "TEXTAREA") return;
            e.preventDefault();
          }}
        >
          <div className="pointer-events-none absolute -left-[10000px] h-0 w-0 overflow-hidden opacity-0">
            <label htmlFor="company">Company</label>
            <input type="text" id="company" name="company" tabIndex={-1} autoComplete="off" />
          </div>

          <input type="hidden" name="seasonId" value={seasonId} readOnly />
          <input type="hidden" name="__vbsSubmitNonce" value={clientSubmitKey} readOnly />
          <input type="hidden" name="childCount" value={children.length} readOnly />
          <input type="hidden" name="confirmedAccurate" value={confirmAccurate ? "true" : "false"} readOnly />
          <input type="hidden" name="smsConsent" value={smsConsent ? "true" : "false"} readOnly />
          <input
            type="hidden"
            name="waiverPerChildJson"
            value={JSON.stringify(
              waiverPerChild.map((w) => ({
                signerName: w.signerName,
                signedAtIso: w.signedAtIso,
                signatureDataUrl: w.signatureDataUrl,
                accepted: w.accepted,
                supplemental: w.supplemental,
              })),
            )}
            readOnly
          />
          {payLaterAvailable || stripeFeeConfigured ? (
            <input
              type="hidden"
              name="paymentChoice"
              value={payLaterAvailable ? paymentChoice : "card"}
              readOnly
            />
          ) : null}
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
              {translateServerMessage(locale, state.message)}
            </div>
          )}
          {state &&
            !state.ok &&
            hasFieldErrors(state) &&
            !(
              step === reviewStepIndex &&
              state.fieldErrors &&
              Object.keys(state.fieldErrors).length > 0 &&
              Object.keys(state.fieldErrors).every((k) => /^childDateOfBirth__\d+$/.test(k))
            ) && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
                {translateServerMessage(locale, state.message)}
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

          {currentStepKind === "guardian" && (
            <div className={sectionCard}>
              <SectionHeader
                title={
                  currentStepFormSections.length === 1
                    ? translateSectionTitle(
                        locale,
                        currentStepFormSections[0]?.title ??
                          portalBranding?.contactSectionLabel ??
                          t("contactInformation"),
                      )
                    : (currentStep?.label ?? translateSectionTitle(locale, portalBranding?.contactSectionLabel ?? t("yourInformation")))
                }
                description={
                  currentStepFormSections.length === 1
                    ? translateSectionDescription(
                        locale,
                        currentStepFormSections[0]?.description?.trim() || t("guardianContactDesc"),
                      )
                    : undefined
                }
              />
              {seasons.length > 1 && (
                <div className="mb-5">
                  <label htmlFor="seasonSel" className={labelClass}>
                    {sessionPickerLabel}
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
              {currentStepFormSections.map((sec) => (
                <div key={sec.id} className="mb-6 last:mb-0">
                  {currentStepFormSections.length > 1 ? (
                    <>
                      <h3 className="mb-3 text-sm font-bold text-white">
                        {translateSectionTitle(locale, sec.title)}
                      </h3>
                      {sec.description ? (
                        <p className="mb-3 text-sm text-neutral-300/85">
                          {translateSectionDescription(locale, sec.description)}
                        </p>
                      ) : null}
                    </>
                  ) : null}
                  <div className="grid gap-4 sm:grid-cols-2">
                    {formDef.fields
                      .filter((f) => f.sectionId === sec.id)
                      .map((f) => {
                        if (f.type === "sectionHeader" || f.type === "staticText") {
                          return (
                            <div key={f.id} className="sm:col-span-2">
                              {renderFieldInput(f, "", () => {}, rules, undefined, ui)}
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
                              ui,
                            )}
                            {f.key === "guardianEmail" && showEmailError ? (
                              <p className={`${hintClass} text-red-600`}>{t("validEmail")}</p>
                            ) : null}
                          </div>
                        );
                      })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {currentStepKind === "participants" && (
            <div className={sectionCard}>
              <SectionHeader
                title={currentStep?.label ?? translateSectionTitle(locale, portalBranding?.participantSectionLabel ?? t("participants"))}
                description={
                  translateSectionDescription(
                    locale,
                    currentStepFormSections[0]?.description?.trim() ||
                      t("participantsDesc", { label: participantLabel.toLowerCase() }),
                  )
                }
              />
              {currentStepShowsAgeGate ? (
              <p className="mb-4 rounded-lg border border-white/15 bg-white/8 px-3 py-2 text-sm text-neutral-100/90">
                {t("ageGate", {
                  label: participantLabel.toLowerCase(),
                  min: participantAgeRules.minimumYears,
                  max: participantAgeRules.maximumYears,
                  asOf: formatRegistrationDate(participantAgeRules.asOfDate, locale),
                })}
              </p>
              ) : null}
              {children.map((ch, idx) => {
                const childShowsDob = currentStepFormSections
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
                      <span className="text-sm font-bold text-brand">{participantLabel} {idx + 1}</span>
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
                          {t("remove")}
                        </button>
                      )}
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {currentStepFormSections.flatMap((sec) =>
                        formDef.fields
                          .filter((field) => field.sectionId === sec.id)
                          .map((field) => {
                            if (field.type === "sectionHeader" || field.type === "staticText") {
                              return (
                                <div key={field.id} className="sm:col-span-2">
                                  {renderFieldInput(field, "", () => {}, rules, undefined, ui)}
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
                                    {
                                      fieldInstanceKey: ch.id,
                                      ...(field.key === "childDateOfBirth"
                                        ? {
                                            onBlurWithValue: (dobVal: string) => applyLiveDobAgeCheck(idx, dobVal),
                                          }
                                        : {}),
                                    },
                                    ui,
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
              {isLastParticipantStep && children.length < 8 && (
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
                  {t("addAnother", { label: participantLabel.toLowerCase() })}
                </button>
              )}
            </div>
          )}

          {currentStepKind === "consent" && (
            <div className={sectionCard}>
              <SectionHeader
                title={
                  translateSectionTitle(
                    locale,
                    currentStepFormSections[0]?.title?.trim() || currentStep?.label || t("additionalInformation"),
                  )
                }
                description={
                  currentStepFormSections.length === 1
                    ? translateSectionDescription(locale, currentStepFormSections[0]?.description?.trim() || undefined)
                    : undefined
                }
              />
              {currentStepFormSections.map((sec) => (
                <div key={sec.id} className="mt-5">
                  {currentStepFormSections.length > 1 ? (
                    <h3 className="font-semibold text-neutral-100">{translateSectionTitle(locale, sec.title)}</h3>
                  ) : null}
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
                            undefined,
                            ui,
                          )}
                        </div>
                      );
                    })}
                </div>
              ))}
              {(effectiveContactFooterText || effectiveContactEmail || contactPhone) && (
                <div className="mt-5 rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-neutral-100">
                  {effectiveContactFooterText ? (
                    <p className="text-neutral-200/90">{effectiveContactFooterText}</p>
                  ) : (
                    <>
                      <p className="font-semibold">{t("questions")}</p>
                      <p className="mt-1 text-neutral-200/90">
                        {effectiveContactEmail ? (
                          <a href={`mailto:${effectiveContactEmail}`} className="font-medium text-brand underline">
                            {effectiveContactEmail}
                          </a>
                        ) : null}
                        {effectiveContactEmail && contactPhone ? " · " : null}
                        {contactPhone ? (
                          <a href={`tel:${phoneDigits(contactPhone)}`} className="font-medium text-brand underline">
                            {contactPhone}
                          </a>
                        ) : null}
                      </p>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {currentStepKind === "waiver" && (
            <div className={sectionCard}>
              <SectionHeader
                title={t("digitalWaiver")}
                description={
                  children.length > 1
                    ? t("waiverMultiChild", {
                        count: children.length,
                        label: participantLabel.toLowerCase(),
                      })
                    : t("waiverSingleChild")
                }
              />
              <div className="mt-5 space-y-4">
                <div className="rounded-xl border border-white/15 bg-white/10 p-4">
                  <h3 className="text-xl font-extrabold tracking-tight text-neutral-50 sm:text-2xl">
                    {waiverDisplay?.title}
                  </h3>
                  {waiverDisplay?.description ? (
                    <p className="mt-3 whitespace-pre-wrap text-base font-semibold leading-relaxed text-neutral-200">
                      {waiverDisplay.description}
                    </p>
                  ) : null}
                  <div
                    role="separator"
                    aria-hidden
                    className={`h-px w-full bg-gradient-to-r from-transparent via-white/30 to-transparent ${waiverDisplay?.description ? "my-5" : "my-4"}`}
                  />
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-200/90">
                    {waiverDisplay?.body}
                  </p>
                  <p className="mt-3 text-xs text-neutral-300/90">
                    {children.length > 1 ? t("waiverEachCard") : t("waiverParticipantFromStep")}
                  </p>
                </div>
                {children.map((ch, idx) => {
                  const w = waiverPerChild[idx];
                  const fname = ch.values.childFirstName ?? "";
                  const lname = ch.values.childLastName ?? "";
                  const childName = `${fname} ${lname}`.trim() || `Child ${idx + 1}`;
                  const multi = children.length > 1;
                  return (
                    <div key={ch.id} className="rounded-xl border border-brand/30 bg-black/30 p-4">
                      <p className="text-xs font-bold uppercase tracking-wide text-brand">
                        {multi
                          ? t("waiverNofM", { current: idx + 1, total: children.length })
                          : t("waiverFor")}
                      </p>
                      <p className="mt-1 text-xl font-bold leading-snug text-neutral-50">{childName}</p>
                      {multi ? (
                        <p className="mt-2 text-sm text-neutral-300/95">
                          {t("waiverAppliesTo", { name: childName })}
                        </p>
                      ) : null}
                      {!w ? (
                        <p className="mt-2 text-sm text-neutral-400">{t("preparingWaiver")}</p>
                      ) : (
                        <>
                          {(waiverSnap?.supplementalFields ?? []).length > 0 ? (
                            <div className="mt-4 space-y-3">
                              {(waiverSnap?.supplementalFields ?? []).map((d) => (
                                <div key={d.key}>
                                  <label className={labelClass}>
                                    {d.label}
                                    {d.required ? <span className="text-red-400"> *</span> : null}
                                  </label>
                                  <input
                                    value={w.supplemental[d.key] ?? ""}
                                    onChange={(e) =>
                                      setWaiverPerChild((prev) => {
                                        const n = [...prev];
                                        const row = n[idx];
                                        if (!row) return prev;
                                        n[idx] = {
                                          ...row,
                                          supplemental: { ...row.supplemental, [d.key]: e.target.value },
                                        };
                                        return n;
                                      })
                                    }
                                    className={inputClass}
                                  />
                                </div>
                              ))}
                            </div>
                          ) : null}
                          <div className="mt-4 grid gap-4 sm:grid-cols-2">
                            <div>
                              <label className={labelClass}>{t("signerName")}</label>
                              <input
                                value={w.signerName}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setWaiverPerChild((prev) => {
                                    const n = [...prev];
                                    const row = n[idx];
                                    if (!row) return prev;
                                    n[idx] = {
                                      ...row,
                                      signerName: v,
                                      signatureDataUrl: typedSignaturePngDataUrl(v),
                                    };
                                    return n;
                                  });
                                }}
                                placeholder={t("signerNamePlaceholder")}
                                className={inputClass}
                              />
                            </div>
                            <div>
                              <label className={labelClass}>{t("signedAt")}</label>
                              <input
                                type="datetime-local"
                                value={w.signedAtIso}
                                onChange={(e) =>
                                  setWaiverPerChild((prev) => {
                                    const n = [...prev];
                                    const row = n[idx];
                                    if (!row) return prev;
                                    n[idx] = { ...row, signedAtIso: e.target.value };
                                    return n;
                                  })
                                }
                                className={inputClass}
                              />
                            </div>
                          </div>
                          <div className="mt-4">
                            <p className={labelClass}>{t("electronicSignature")}</p>
                            <p className="mt-1 text-xs text-neutral-400">{t("signatureFromName")}</p>
                            <div className="mt-2 rounded-xl border border-white/15 bg-white/10 p-3">
                              <TypedSignaturePreview dataUrl={w.signatureDataUrl} ui={ui} />
                            </div>
                          </div>
                          <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-white/15 bg-black/20 px-4 py-3">
                            <input
                              type="checkbox"
                              checked={w.accepted}
                              onChange={(e) =>
                                setWaiverPerChild((prev) => {
                                  const n = [...prev];
                                  const row = n[idx];
                                  if (!row) return prev;
                                  n[idx] = { ...row, accepted: e.target.checked };
                                  return n;
                                })
                              }
                              className="mt-1 size-5 accent-brand"
                            />
                            <span className="text-sm text-neutral-100">
                              {t("waiverAcceptTerms", { name: childName })}
                            </span>
                          </label>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {step === reviewStepIndex && (
            <div className={sectionCard}>
              <SectionHeader title={t("reviewSubmit")} description={t("reviewSubmitDesc")} />
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/15 bg-white/10 px-4 py-4">
                <input
                  type="checkbox"
                  checked={confirmAccurate}
                  onChange={(e) => setConfirmAccurate(e.target.checked)}
                  className="mt-1 size-5 accent-brand"
                />
                <span className="text-sm leading-relaxed text-neutral-100">
                  {t("confirmAccurate", { eventName })}
                </span>
              </label>
              <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-xl border border-white/15 bg-white/10 px-4 py-4">
                <input
                  type="checkbox"
                  checked={smsConsent}
                  onChange={(e) => setSmsConsent(e.target.checked)}
                  className="mt-1 size-5 accent-brand"
                />
                <span className="text-sm leading-relaxed text-neutral-100">
                  {t("smsConsent", { eventName })}
                </span>
              </label>
              <div className="space-y-4 text-sm">
                <div>
                  <p className="text-xs font-bold uppercase text-neutral-400">{reviewContactLabel}</p>
                  <ul className="mt-1 space-y-1.5">
                    {guardianSections.flatMap((sec) =>
                      formDef.fields
                        .filter(
                          (f) =>
                            f.sectionId === sec.id &&
                            f.type !== "sectionHeader" &&
                            f.type !== "staticText" &&
                            visible(f, guardian),
                        )
                        .map((f) => {
                          const v = guardian[f.key] ?? "";
                          if (!String(v).trim()) return null;
                          return (
                            <li key={f.key} className="flex flex-wrap gap-x-2 gap-y-0.5">
                              <span className="text-neutral-300">
                                {translateFieldForDisplay(locale, f).label?.trim() || f.key}
                              </span>
                              <span className="font-medium text-neutral-50">{v}</span>
                            </li>
                          );
                        }),
                    )}
                  </ul>
                </div>
                {hasParticipantStep ? (
                <div>
                  <p className="text-xs font-bold uppercase text-neutral-400">
                    {reviewParticipantLabel} ({children.length})
                  </p>
                  <ul className="mt-2 space-y-2">
                    {children.map((ch, i) => (
                      <li key={ch.id} className="rounded-lg border border-white/15 bg-black/20 p-2">
                        <span className="font-semibold text-neutral-100">{participantLabel} {i + 1}</span>
                        <ul className="mt-1 space-y-1.5 text-neutral-200/95">
                          {childSections.flatMap((sec) =>
                            formDef.fields
                              .filter(
                                (f) =>
                                  f.sectionId === sec.id &&
                                  f.type !== "sectionHeader" &&
                                  f.type !== "staticText" &&
                                  visible(f, ch.values),
                              )
                              .map((f) => {
                                const v = ch.values[f.key] ?? "";
                                if (!String(v).trim()) return null;
                                return (
                                  <li key={f.key} className="flex flex-wrap gap-x-2 gap-y-0.5">
                                    <span className="text-neutral-300">
                                {translateFieldForDisplay(locale, f).label?.trim() || f.key}
                              </span>
                                    <span className="font-medium text-neutral-50">{v}</span>
                                  </li>
                                );
                              }),
                          )}
                        </ul>
                        {reviewChildDobFieldMessages?.[i] ? (
                          <div
                            id={`review-child-dob-age-${i}`}
                            className="mt-2 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100"
                            role="alert"
                          >
                            <X className="mt-0.5 size-4 shrink-0" aria-hidden />
                            <span>{translateServerMessage(locale, reviewChildDobFieldMessages[i])}</span>
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
                ) : null}
                <div>
                  <p className="text-xs font-bold uppercase text-neutral-400">{t("smsUpdates")}</p>
                  <p className="mt-1 text-neutral-200/90">{smsConsent ? t("consented") : t("notConsented")}</p>
                </div>
                {waiverStepActive && waiverPerChild.length === children.length ? (
                  <div className="rounded-lg border border-white/15 bg-white/8 px-3 py-2.5">
                    <p className="text-xs font-bold uppercase text-neutral-400">{t("waiver")}</p>
                    <p className="mt-1 text-sm text-neutral-200/95">
                      {t("waiverSignedFor", {
                        count: children.length,
                        label:
                          children.length === 1
                            ? participantLabel.toLowerCase()
                            : `${participantLabel.toLowerCase()}s`,
                        eventName: season.name,
                      })}
                    </p>
                  </div>
                ) : null}
                {payLaterAvailable || stripePayment.active ? (
                  <div className="mt-5 space-y-4">
                    <p className="text-xs font-bold uppercase text-neutral-400">{t("payment")}</p>
                    {payLaterAvailable ? (
                      <div className="space-y-2 rounded-xl border border-white/15 bg-white/8 p-3">
                        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-white/10 bg-black/20 px-3 py-3">
                          <input
                            type="radio"
                            name="paymentChoiceUi"
                            className="mt-1 size-4 accent-brand"
                            checked={paymentChoice === "card"}
                            onChange={() => setPaymentChoice("card")}
                          />
                          <span className="text-sm text-neutral-100">
                            <strong className="font-semibold">{t("payCardNow")}</strong>
                            <span className="mt-1 block text-neutral-300/90">{t("payCardNowDetail")}</span>
                          </span>
                        </label>
                        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-white/10 bg-black/20 px-3 py-3">
                          <input
                            type="radio"
                            name="paymentChoiceUi"
                            className="mt-1 size-4 accent-brand"
                            checked={paymentChoice === "pay_later"}
                            onChange={() => setPaymentChoice("pay_later")}
                          />
                          <span className="text-sm text-neutral-100">
                            <strong className="font-semibold">{t("payLater")}</strong>
                            <span className="mt-1 block text-neutral-300/90">
                              {isLegacyVbs
                                ? t("payLaterDetailVbs")
                                : t("payLaterDetailEvent", { eventName: current?.name ?? "the event" })}
                            </span>
                          </span>
                        </label>
                      </div>
                    ) : null}
                    {payLaterAvailable && paymentChoice === "pay_later" ? (
                      <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm leading-relaxed text-amber-100">
                        {payLaterParagraphs.map((para) => (
                          <p key={para.slice(0, 48)} className="mt-2 first:mt-0">
                            {para}
                          </p>
                        ))}
                      </div>
                    ) : null}
                    {stripePayment.active ? (
                  <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-600 dark:bg-neutral-900/60">
                    <p className="text-xs font-bold uppercase text-neutral-500">{t("cardPayment")}</p>
                    <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">{stripePayment.label}</p>
                    <dl className="mt-3 space-y-1 text-sm">
                      <div className="flex justify-between gap-4">
                        <dt className="text-neutral-600 dark:text-neutral-400">
                          {stripePayment.unit === "PER_CHILD"
                            ? stripePayment.capPaidChildrenAtThree &&
                              stripePayment.childCount > STRIPE_PER_CHILD_MAX_PAID_COUNT
                              ? `Program fee (${stripePayment.billableChildren} of ${stripePayment.childCount} children; additional children no charge)`
                              : `Program fee (${children.length} ${children.length === 1 ? "child" : "children"})`
                            : children.length > 1
                              ? `Program fee (one payment — all ${children.length} children)`
                              : "Program fee"}
                        </dt>
                        <dd className="font-medium text-neutral-900 dark:text-neutral-50">
                          {formatUsdFromCents(stripePayment.baseCents)}
                        </dd>
                      </div>
                      {stripePayment.processingCents > 0 ? (
                        <div className="flex justify-between gap-4">
                          <dt className="text-neutral-600 dark:text-neutral-400">{t("processingFeeEst")}</dt>
                          <dd className="font-medium text-neutral-900 dark:text-neutral-50">
                            {formatUsdFromCents(stripePayment.processingCents)}
                          </dd>
                        </div>
                      ) : null}
                      <div className="flex justify-between gap-4 border-t border-neutral-200 pt-2 dark:border-neutral-600">
                        <dt className="font-semibold text-neutral-900 dark:text-neutral-100">{t("totalDue")}</dt>
                        <dd className="font-semibold text-neutral-900 dark:text-neutral-50">
                          {formatUsdFromCents(stripePayment.totalCents)}
                        </dd>
                      </div>
                    </dl>
                    <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">{t("stripeAfterSubmit")}</p>
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
                          {t("coverProcessingFee", {
                            amount: formatUsdFromCents(
                              computeProcessingGrossUp(stripePayment.baseCents, true).processingCents,
                            ),
                          })}
                        </span>
                      </label>
                    ) : (
                      <p className="mt-3 text-sm font-medium text-neutral-800 dark:text-neutral-200">
                        {t("processingFeeIncluded")}
                      </p>
                    )}
                  </div>
                    ) : null}
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
                  className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-white/25 bg-white/10 px-4 py-2 text-sm font-semibold text-neutral-100 shadow-sm hover:bg-white/15"
                >
                  <ChevronLeft className="size-4" aria-hidden />
                  {t("back")}
                </button>
              ) : hasConsentFormFields ? (
                <span className="text-sm text-neutral-300/90">{t("needHelpPrivacy")}</span>
              ) : effectiveContactEmail ? (
                <span className="text-sm text-neutral-300/90">
                  {t("needHelpEmail")}{" "}
                  <a href={`mailto:${effectiveContactEmail}`} className="text-brand underline-offset-2 hover:underline">
                    {effectiveContactEmail}
                  </a>
                </span>
              ) : (
                <span className="text-sm text-neutral-300/90">{t("needHelpOrganizer")}</span>
              )}
            </div>
            <div>
              {step < totalSteps - 1 ? (
                <button
                  type="button"
                  onClick={goNext}
                  className="inline-flex min-h-11 items-center gap-1 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground shadow-sm"
                >
                  {t("continue")}
                  <ChevronRight className="size-4" aria-hidden />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={pending}
                  aria-label={primarySubmitLabel}
                  onClick={() => {
                    if (step !== reviewStepIndex) return;
                    nativeSubmitRef.current?.click();
                  }}
                  className="inline-flex min-h-11 rounded-xl bg-brand px-6 py-2.5 text-sm font-semibold text-brand-foreground disabled:opacity-50"
                >
                  {pending ? t("submitting") : primarySubmitLabel}
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
                  {t("back")}
                </button>
              ) : (
                <div className="min-h-12 flex-1" />
              )}
              {step < totalSteps - 1 ? (
                <button
                  type="button"
                  onClick={goNext}
                  className="inline-flex min-h-12 flex-[2] items-center justify-center gap-1 rounded-xl bg-brand text-sm font-semibold text-brand-foreground"
                >
                  {t("continue")}
                  <ChevronRight className="size-4" aria-hidden />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={pending}
                  aria-label={primarySubmitLabel}
                  onClick={() => {
                    if (step !== reviewStepIndex) return;
                    nativeSubmitRef.current?.click();
                  }}
                  className="inline-flex min-h-12 flex-[2] items-center justify-center rounded-xl bg-brand text-sm font-semibold text-brand-foreground disabled:opacity-50"
                >
                  {pending ? t("submitting") : mobileSubmitLabel}
                </button>
              )}
            </div>
          </div>

          {step === reviewStepIndex ? (
            <button
              ref={nativeSubmitRef}
              type="submit"
              tabIndex={-1}
              aria-hidden="true"
              disabled={pending}
              className="sr-only"
            >
              {t("submitRegistration")}
            </button>
          ) : null}
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
