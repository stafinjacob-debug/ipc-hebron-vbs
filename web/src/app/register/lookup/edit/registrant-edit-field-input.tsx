"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormFieldDef } from "@/lib/registration-form-definition";
import type { PublicRegistrationFieldRules } from "@/lib/public-registration";
import { formatPhoneInput } from "@/lib/phone-format";
import { isRegistrantFieldVisible, registrantEditFieldName } from "@/lib/registrant-edit-form";

const labelClass = "block text-sm font-medium text-foreground";
const hintClass = "mt-1 text-xs text-muted";
const inputClass =
  "mt-1 w-full rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-brand/70 focus:outline-none focus:ring-2 focus:ring-brand/20";

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
  name,
  value,
  onChange,
  required,
  helperText,
}: {
  field: FormFieldDef;
  name: string;
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
        {required ? <span className="text-red-600"> *</span> : null}
      </p>
      {helperText ? <p className={hintClass}>{helperText}</p> : null}
      <input type="hidden" name={name} value={value} readOnly />
      <div className="mt-2 space-y-2">
        <label className="flex cursor-pointer items-center gap-2 rounded-md border border-foreground/10 px-3 py-2">
          <input
            type="radio"
            checked={state.answer === "no"}
            onChange={() => sync({ answer: "no", selected: [], other: "" })}
            className="size-4 accent-brand"
          />
          <span className="text-sm">No</span>
        </label>
        <label className="flex cursor-pointer items-center gap-2 rounded-md border border-foreground/10 px-3 py-2">
          <input
            type="radio"
            checked={state.answer === "yes"}
            onChange={() => sync({ ...state, answer: "yes" })}
            className="size-4 accent-brand"
          />
          <span className="text-sm">Yes</span>
        </label>
      </div>
      {state.answer === "yes" ? (
        <div className="mt-3 space-y-2 rounded-md border border-foreground/10 bg-foreground/[0.02] p-3">
          <p className="text-sm font-medium">Select all that apply:</p>
          {ALLERGY_PRESET_OPTIONS.map((option) => {
            const checked = state.selected.includes(option);
            return (
              <label key={option} className="flex cursor-pointer items-center gap-2 text-sm">
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
          <div>
            <label className="text-sm font-medium">Other</label>
            <input
              type="text"
              value={state.other}
              onChange={(e) => sync({ ...state, other: e.target.value })}
              placeholder="Describe other allergies or medical needs"
              className={inputClass}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

type RegistrantEditFieldInputProps = {
  field: FormFieldDef;
  value: string;
  onChange: (value: string) => void;
  rules: PublicRegistrationFieldRules;
  registrationId?: string;
};

export function RegistrantEditFieldInput({
  field,
  value,
  onChange,
  rules,
  registrationId,
}: RegistrantEditFieldInputProps) {
  const name = registrantEditFieldName(field.key, registrationId);
  const inputId = registrationId ? `edit-${field.id}-${registrationId}` : `edit-${field.id}`;

  if (field.type === "sectionHeader") {
    return <h3 className="pt-2 text-sm font-semibold text-foreground">{field.label}</h3>;
  }
  if (field.type === "staticText") {
    return (
      <p className="rounded-md bg-foreground/[0.03] px-3 py-2 text-sm text-muted">
        {field.helperText || field.label}
      </p>
    );
  }

  const required =
    field.required ||
    (field.key === "guardianEmail" && rules.requireGuardianEmail) ||
    (field.key === "guardianPhone" && rules.requireGuardianPhone) ||
    (field.key === "allergiesNotes" && rules.requireAllergiesNotes);

  const label = (
    <label htmlFor={inputId} className={labelClass}>
      {field.label}
      {required ? <span className="text-red-600"> *</span> : null}
    </label>
  );

  if (field.type === "textarea" && field.key === "allergiesNotes") {
    return (
      <AllergiesFieldInput
        field={field}
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        helperText={
          rules.requireAllergiesNotes
            ? "Required — enter “None” if not applicable."
            : field.helperText ?? "Optional — helps teachers keep everyone safe."
        }
      />
    );
  }

  if (field.type === "textarea") {
    return (
      <div>
        {label}
        <textarea
          id={inputId}
          name={name}
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
        {label}
        <select
          id={inputId}
          name={name}
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
                name={name}
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

  if (field.type === "checkbox" || field.type === "boolean") {
    return (
      <label className="flex cursor-pointer items-start gap-3">
        <input
          id={inputId}
          type="checkbox"
          name={name}
          checked={value === "true"}
          onChange={(e) => onChange(e.target.checked ? "true" : "")}
          className="mt-0.5 size-4 accent-brand"
        />
        <span>
          <span className="text-sm font-medium">{field.label}</span>
          {field.helperText ? <span className="mt-1 block text-xs text-muted">{field.helperText}</span> : null}
        </span>
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

  return (
    <div>
      {label}
      <input
        id={inputId}
        type={inputType}
        name={name}
        value={value}
        onChange={(e) =>
          onChange(field.key === "guardianPhone" ? formatPhoneInput(e.target.value) : e.target.value)
        }
        placeholder={field.placeholder}
        className={inputClass}
      />
      {field.helperText ? <p className={hintClass}>{field.helperText}</p> : null}
    </div>
  );
}

export function RegistrantEditFieldGroup({
  fields,
  values,
  onChange,
  rules,
  registrationId,
}: {
  fields: FormFieldDef[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  rules: PublicRegistrationFieldRules;
  registrationId?: string;
}) {
  return (
    <div className="space-y-4">
      {fields.map((field) => {
        if (!isRegistrantFieldVisible(field, values)) return null;
        return (
          <RegistrantEditFieldInput
            key={registrationId ? `${field.id}-${registrationId}` : field.id}
            field={field}
            value={values[field.key] ?? ""}
            onChange={(v) => onChange(field.key, v)}
            rules={rules}
            registrationId={registrationId}
          />
        );
      })}
    </div>
  );
}
