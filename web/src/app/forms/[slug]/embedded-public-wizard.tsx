"use client";

import { useMemo, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  applicantVisibleSections,
  emptyEducationEntry,
  fieldIsVisible,
  fieldsForEmbeddedSection,
  isFillableEmbeddedField,
  readEducationEntries,
  type EducationEntry,
  type EmbeddedFormDefinitionV1,
  type EmbeddedFormFieldDef,
} from "@/lib/embedded-form-definition";
import { ageFromDob, validateEmbeddedApplicantField } from "@/lib/embedded-form-validate";
import { submitEmbeddedFormPublic } from "@/app/forms/actions";

type Props = {
  slug: string;
  title: string;
  subtitle: string | null;
  welcomeMessage: string | null;
  confirmationMessage: string | null;
  definition: EmbeddedFormDefinitionV1;
  helpEmail: string | null;
  helpPhone: string | null;
  stripeCheckoutEnabled?: boolean;
  stripeAmountCents?: number | null;
  stripeIncludeProcessingFee?: boolean;
  stripeFeePreview?: { totalCents: number; processingCents: number } | null;
};

type FormValue = string | string[] | EducationEntry[];

function widthClass(width?: string): string {
  switch (width) {
    case "half":
      return "md:col-span-6";
    case "third":
      return "md:col-span-4";
    case "quarter":
      return "md:col-span-3";
    default:
      return "md:col-span-12";
  }
}

const fieldLabelClass = "mb-1.5 block text-[0.95rem] font-semibold leading-snug text-neutral-950";
const fieldControlClass =
  "w-full rounded-lg border border-slate-400 bg-white px-3.5 py-3 text-base text-neutral-950 shadow-sm outline-none placeholder:text-slate-400 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100";
const helperClass = "mt-1.5 text-sm text-slate-700";
const errorClass = "mt-1.5 text-sm text-rose-600";

export function EmbeddedPublicWizard(props: Props) {
  const router = useRouter();
  const sections = useMemo(() => applicantVisibleSections(props.definition), [props.definition]);
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<Record<string, FormValue>>({});
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [documentFiles, setDocumentFiles] = useState<File[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [clientSubmitKey] = useState(() =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `k-${Date.now()}`,
  );

  const isReview = step >= sections.length;
  const currentSection = !isReview ? sections[step] : null;

  function setValue(key: string, value: FormValue) {
    setValues((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "declarationName" || key === "fullName") {
        const legal = String(
          (key === "declarationName" ? value : next.declarationName) ||
            (key === "fullName" ? value : next.fullName) ||
            "",
        ).trim();
        if (legal) next.applicantSignature = legal;
      }
      if (key === "maritalStatus" && value !== "Married") {
        delete next.dateOfMarriage;
        delete next.spouseName;
        delete next.child1NameAge;
        delete next.child2NameAge;
        delete next.child3NameAge;
      }
      if (key === "ordainedPastor" && value !== "Yes") {
        delete next.ordinationDetails;
      }
      if (key === "dobMonth" || key === "dobDay" || key === "dobYear") {
        const age = ageFromDob(
          Number(next.dobDay),
          Number(next.dobMonth),
          Number(next.dobYear),
        );
        if (age != null) next.ageNow = String(age);
        else delete next.ageNow;
      }
      return next;
    });
  }

  function validateSection(sectionId: string): Record<string, string> {
    const errors: Record<string, string> = {};
    const fields = fieldsForEmbeddedSection(props.definition, sectionId).filter(
      (field) => isFillableEmbeddedField(field) && fieldIsVisible(field, values),
    );

    for (const field of fields) {
      if (field.type === "photo") {
        if (field.required && !photoFile) {
          errors[field.key] = "Please upload a passport photo.";
        }
        continue;
      }
      if (field.type === "documentUploads") {
        if (field.required && documentFiles.length === 0) {
          errors[field.key] = "Please upload at least one academic document.";
        }
        continue;
      }
      if (field.type === "educationEntries") {
        const entries = readEducationEntries(values[field.key]).filter(
          (row) => row.description.trim() || row.institution.trim(),
        );
        if (field.required && entries.length === 0) {
          errors[field.key] = "Add at least one educational qualification.";
        } else {
          for (let i = 0; i < entries.length; i++) {
            const row = entries[i]!;
            if (!row.description.trim()) {
              errors[field.key] = `Education row ${i + 1}: choose a description.`;
              break;
            }
            if (!row.institution.trim()) {
              errors[field.key] = `Education row ${i + 1}: enter name & place of institution.`;
              break;
            }
          }
        }
        continue;
      }
      if (field.type === "signatureTyped") continue;

      const raw = values[field.key];
      const err = validateEmbeddedApplicantField(
        field,
        Array.isArray(raw) ? (raw as string[]) : String(raw ?? ""),
      );
      if (err) errors[field.key] = err;
    }
    return errors;
  }

  function goToFirstError(errors: Record<string, string>, fallbackMessage: string) {
    const firstKey = Object.keys(errors)[0];
    const firstField = firstKey
      ? props.definition.fields.find((field) => field.key === firstKey)
      : undefined;
    if (firstField) {
      const sectionIndex = sections.findIndex((section) => section.id === firstField.sectionId);
      if (sectionIndex >= 0) setStep(sectionIndex);
    }
    setFieldErrors(errors);
    setError(errors[firstKey ?? ""] || fallbackMessage);
  }

  function continueToNext() {
    if (!currentSection) return;
    const errors = validateSection(currentSection.id);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      const first = Object.values(errors)[0] ?? "Please complete the required fields on this page.";
      setError(`${first} Complete this page before continuing.`);
      return;
    }
    setFieldErrors({});
    setError(null);
    setStep((s) => Math.min(sections.length, s + 1));
  }

  function renderField(field: EmbeddedFormFieldDef) {
    if (!fieldIsVisible(field, values)) return null;
    if (!isFillableEmbeddedField(field) && field.type !== "staticText" && field.type !== "declaration") {
      return null;
    }

    const err = fieldErrors[field.key];
    const commonLabel = (
      <span className={fieldLabelClass}>
        {field.label}
        {field.required ? <span className="text-rose-600"> *</span> : null}
      </span>
    );

    if (field.type === "staticText") {
      return (
        <div key={field.id} className="md:col-span-12 rounded-lg border border-slate-200 bg-slate-50 p-4 text-base text-neutral-900">
          <p className="font-semibold text-neutral-950">{field.label}</p>
          {field.helperText ? <p className="mt-2 whitespace-pre-wrap leading-relaxed">{field.helperText}</p> : null}
        </div>
      );
    }

    if (field.type === "photo") {
      return (
        <div key={field.id} className="md:col-span-12">
          {commonLabel}
          <div className="flex flex-wrap items-start gap-4">
            <label className="flex h-48 w-40 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-indigo-300 bg-indigo-50/40 text-center text-sm text-indigo-800">
              {photoPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoPreview} alt="Preview" className="h-full w-full rounded-lg object-cover" />
              ) : (
                <>
                  <span className="font-semibold">Passport photo</span>
                  <span className="mt-1 underline">browse files</span>
                </>
              )}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  setPhotoFile(file);
                  if (photoPreview) URL.revokeObjectURL(photoPreview);
                  setPhotoPreview(file ? URL.createObjectURL(file) : null);
                }}
              />
            </label>
            {field.helperText ? <p className={`${helperClass} max-w-xl`}>{field.helperText}</p> : null}
          </div>
          {err ? <p className={errorClass}>{err}</p> : null}
        </div>
      );
    }

    if (field.type === "documentUploads") {
      const maxFiles = field.validation?.max ?? 5;
      return (
        <div key={field.id} className="md:col-span-12 space-y-2">
          {commonLabel}
          {field.helperText ? <p className={helperClass}>{field.helperText}</p> : null}
          <label className="flex cursor-pointer flex-col items-start gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-5 text-base text-slate-800 hover:border-indigo-300 hover:bg-indigo-50/40">
            <span className="font-semibold text-indigo-800">Choose academic documents</span>
            <span className="text-sm text-slate-700">PDF or images · up to {maxFiles} files · 5 MB each</span>
            <input
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              multiple
              className="sr-only"
              onChange={(e) => {
                const next = Array.from(e.target.files ?? []).slice(0, maxFiles);
                setDocumentFiles(next);
              }}
            />
          </label>
          {documentFiles.length > 0 ? (
            <ul className="space-y-1 text-base text-slate-800">
              {documentFiles.map((file) => (
                <li key={`${file.name}-${file.size}`} className="rounded-md bg-white px-3 py-2 border border-slate-200">
                  {file.name}{" "}
                  <span className="text-sm text-slate-600">
                    ({Math.round(file.size / 1024)} KB)
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          {documentFiles.length > 0 ? (
            <button
              type="button"
              className="text-sm font-medium text-rose-600 hover:underline"
              onClick={() => setDocumentFiles([])}
            >
              Clear documents
            </button>
          ) : null}
          {err ? <p className={errorClass}>{err}</p> : null}
        </div>
      );
    }

    if (field.type === "radio") {
      return (
        <fieldset key={field.id} className={widthClass(field.layout?.width)}>
          {commonLabel}
          <div className="flex flex-wrap gap-5 pt-1">
            {(field.options ?? []).map((opt) => (
              <label key={opt.value} className="inline-flex items-center gap-2.5 text-base text-neutral-950">
                <input
                  type="radio"
                  name={field.key}
                  value={opt.value}
                  checked={values[field.key] === opt.value}
                  onChange={() => setValue(field.key, opt.value)}
                  className="h-4 w-4"
                />
                {opt.label}
              </label>
            ))}
          </div>
          {err ? <p className={errorClass}>{err}</p> : null}
        </fieldset>
      );
    }

    if (field.type === "checkboxGroup") {
      const selected = Array.isArray(values[field.key]) ? (values[field.key] as string[]) : [];
      return (
        <fieldset key={field.id} className="md:col-span-12">
          {commonLabel}
          <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(field.options ?? []).map((opt) => {
              const checked = selected.includes(opt.value);
              return (
                <label key={opt.value} className="inline-flex items-start gap-2.5 text-base text-neutral-950">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      const next = checked
                        ? selected.filter((v) => v !== opt.value)
                        : [...selected, opt.value];
                      setValue(field.key, next);
                    }}
                    className="mt-1 h-4 w-4"
                  />
                  <span>{opt.label}</span>
                </label>
              );
            })}
          </div>
          {err ? <p className={errorClass}>{err}</p> : null}
        </fieldset>
      );
    }

    if (field.type === "educationEntries") {
      const entries = readEducationEntries(values[field.key]);
      const options = field.options?.length
        ? field.options
        : [
            { value: "High School", label: "High School" },
            { value: "Undergrad", label: "Undergrad" },
            { value: "Graduate School", label: "Graduate School" },
            { value: "Other, if any", label: "Other, if any" },
          ];
      const used = new Set(entries.map((e) => e.description).filter(Boolean));
      const available = options.filter((o) => !used.has(o.value));

      function updateEntry(index: number, patch: Partial<EducationEntry>) {
        const next = entries.map((row, i) => (i === index ? { ...row, ...patch } : row));
        setValue(field.key, next);
      }

      return (
        <div key={field.id} className="md:col-span-12 space-y-3">
          {commonLabel}
          {field.helperText ? <p className={helperClass}>{field.helperText}</p> : null}
          {entries.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-base text-slate-700">
              No education rows yet. Add High School, Undergrad, Graduate School, or Other as needed.
            </p>
          ) : null}
          {entries.map((row, index) => (
            <div
              key={`${field.key}-${index}`}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-base font-semibold text-neutral-950">Education {index + 1}</p>
                <button
                  type="button"
                  className="text-sm font-medium text-rose-600 hover:underline"
                  onClick={() => setValue(field.key, entries.filter((_, i) => i !== index))}
                >
                  Remove
                </button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block sm:col-span-2">
                  <span className={fieldLabelClass}>Description</span>
                  <select
                    value={row.description}
                    onChange={(e) => updateEntry(index, { description: e.target.value })}
                    className={fieldControlClass}
                  >
                    <option value="">Select level…</option>
                    {options.map((opt) => (
                      <option
                        key={opt.value}
                        value={opt.value}
                        disabled={used.has(opt.value) && row.description !== opt.value}
                      >
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block sm:col-span-2">
                  <span className={fieldLabelClass}>
                    Name & place of institution
                  </span>
                  <input
                    value={row.institution}
                    onChange={(e) => updateEntry(index, { institution: e.target.value })}
                    className={fieldControlClass}
                  />
                </label>
                <label className="block">
                  <span className={fieldLabelClass}>Date of completion</span>
                  <input
                    type="date"
                    value={row.completionDate}
                    onChange={(e) => updateEntry(index, { completionDate: e.target.value })}
                    className={fieldControlClass}
                  />
                </label>
                <label className="block">
                  <span className={fieldLabelClass}>Diploma / degree</span>
                  <input
                    value={row.diplomaDegree}
                    onChange={(e) => updateEntry(index, { diplomaDegree: e.target.value })}
                    className={fieldControlClass}
                  />
                </label>
                <label className="block">
                  <span className={fieldLabelClass}>Class / division</span>
                  <input
                    value={row.classDivision}
                    onChange={(e) => updateEntry(index, { classDivision: e.target.value })}
                    className={fieldControlClass}
                  />
                </label>
                <label className="block">
                  <span className={fieldLabelClass}>Passed / failed</span>
                  <select
                    value={row.passedFailed}
                    onChange={(e) => updateEntry(index, { passedFailed: e.target.value })}
                    className={fieldControlClass}
                  >
                    <option value="">—</option>
                    <option value="Passed">Passed</option>
                    <option value="Failed">Failed</option>
                  </select>
                </label>
              </div>
            </div>
          ))}
          {available.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {available.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className="rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-800 hover:bg-indigo-100"
                  onClick={() => setValue(field.key, [...entries, emptyEducationEntry(opt.value)])}
                >
                  + Add {opt.label}
                </button>
              ))}
            </div>
          ) : null}
          {err ? <p className={errorClass}>{err}</p> : null}
        </div>
      );
    }

    if (field.type === "declaration" || field.type === "checkbox") {
      return (
        <label key={field.id} className="md:col-span-12 inline-flex items-start gap-3 text-base text-neutral-950">
          <input
            type="checkbox"
            name={field.key}
            checked={values[field.key] === "true"}
            onChange={(e) => setValue(field.key, e.target.checked ? "true" : "")}
            className="mt-1 h-4 w-4"
          />
          <span>
            {field.label}
            {field.required ? <span className="text-rose-600"> *</span> : null}
            {err ? <span className={`block ${errorClass}`}>{err}</span> : null}
          </span>
        </label>
      );
    }

    if (field.type === "textarea") {
      const text = String(values[field.key] ?? "");
      const minLength = field.validation?.minLength;
      return (
        <label key={field.id} className={`${widthClass(field.layout?.width)} block`}>
          {commonLabel}
          <textarea
            name={field.key}
            rows={5}
            value={text}
            onChange={(e) => setValue(field.key, e.target.value)}
            className={fieldControlClass}
            placeholder={field.placeholder}
          />
          {minLength ? (
            <p className={text.trim().length < minLength ? errorClass : helperClass}>
              {text.trim().length} / {minLength} characters minimum
            </p>
          ) : null}
          {field.helperText ? <p className={helperClass}>{field.helperText}</p> : null}
          {err ? <p className={errorClass}>{err}</p> : null}
        </label>
      );
    }

    if (field.type === "select") {
      return (
        <label key={field.id} className={`${widthClass(field.layout?.width)} block`}>
          {commonLabel}
          <select
            name={field.key}
            value={String(values[field.key] ?? "")}
            onChange={(e) => setValue(field.key, e.target.value)}
            className={fieldControlClass}
          >
            {(field.options ?? []).map((opt) => (
              <option key={`${field.key}-${opt.value}`} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {err ? <p className={errorClass}>{err}</p> : null}
        </label>
      );
    }

    if (field.type === "signatureTyped") {
      const legalName = String(values.declarationName || values.fullName || "").trim();
      return (
        <div key={field.id} className={`${widthClass(field.layout?.width)} block`}>
          {commonLabel}
          <p className="rounded-lg border border-slate-300 bg-slate-50 px-3.5 py-3 font-serif text-xl italic text-neutral-950">
            {legalName || "Your signature will appear here after you enter your full legal name."}
          </p>
          {field.helperText ? <p className={helperClass}>{field.helperText}</p> : null}
        </div>
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

    const displayValue =
      field.key === "declarationName"
        ? String(values.declarationName ?? values.fullName ?? "")
        : String(values[field.key] ?? "");

    return (
      <label key={field.id} className={`${widthClass(field.layout?.width)} block`}>
        {commonLabel}
        <input
          type={inputType}
          name={field.key}
          value={displayValue}
          readOnly={field.key === "ageNow"}
          onChange={(e) => setValue(field.key, e.target.value)}
          className={`${fieldControlClass} ${field.key === "ageNow" ? "bg-slate-50" : ""}`}
          placeholder={field.key === "ageNow" ? "—" : field.placeholder}
        />
        {field.helperText ? <p className={helperClass}>{field.helperText}</p> : null}
        {err ? <p className={errorClass}>{err}</p> : null}
      </label>
    );
  }

  function onSubmit() {
    setError(null);
    setFieldErrors({});
    for (const section of sections) {
      const errors = validateSection(section.id);
      if (Object.keys(errors).length > 0) {
        goToFirstError(errors, "Please complete the highlighted fields.");
        return;
      }
    }
    startTransition(async () => {
      const fd = new FormData();
      fd.set("clientSubmitKey", clientSubmitKey);
      for (const [key, value] of Object.entries(values)) {
        if (Array.isArray(value)) {
          if (value.length > 0 && typeof value[0] === "object") {
            fd.set(key, JSON.stringify(value));
          } else {
            for (const item of value as string[]) fd.append(key, item);
          }
        } else if (value === "true" && (key === "declarationAccepted" || key.endsWith("Accepted"))) {
          fd.set(key, "on");
        } else if (value) {
          fd.set(key, value);
        }
      }
      // Ensure declaration checkbox posts when checked
      if (values.declarationAccepted === "true") fd.set("declarationAccepted", "on");
      const legalName = String(values.declarationName || values.fullName || "").trim();
      if (legalName) {
        fd.set("declarationName", legalName);
        fd.set("applicantSignature", legalName);
      }

      if (photoFile) {
        fd.set("passportPhoto", photoFile);
        fd.set("passportPhoto__present", "1");
      }
      for (const file of documentFiles) {
        fd.append("academicDocuments", file);
      }
      if (documentFiles.length > 0) {
        fd.set("academicDocuments__count", String(documentFiles.length));
      }

      const result = await submitEmbeddedFormPublic(props.slug, fd);
      if (!result.ok) {
        if (result.fieldErrors && Object.keys(result.fieldErrors).length > 0) {
          goToFirstError(result.fieldErrors, result.error);
        } else {
          setError(result.error);
        }
        return;
      }
      if (props.stripeCheckoutEnabled && result.submissionId) {
        window.location.assign(
          `/forms/${props.slug}/pay?submission=${encodeURIComponent(result.submissionId)}`,
        );
        return;
      }
      router.push(
        `/forms/${props.slug}/thanks?ref=${encodeURIComponent(result.applicationNumber)}`,
      );
    });
  }

  const progress = Math.round(((Math.min(step, sections.length) + (isReview ? 1 : 0)) / (sections.length + 1)) * 100);
  const helpEmail = props.helpEmail?.trim() || "admissions@ipchouston.com";
  const helpPhone = props.helpPhone?.trim() || "";

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-10">
      <header className="mb-8 border-t-[3px] border-[#4f46e5] pt-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/htc-flame-logo.png"
              alt="Hebron Theological College"
              width={48}
              height={68}
              className="h-16 w-auto object-contain"
              priority
            />
            <div className="leading-tight">
              <p className="text-[1.5rem] font-extrabold tracking-wide text-neutral-950 sm:text-[1.7rem]">
                HEBRON
              </p>
              <p className="text-[0.8rem] font-semibold uppercase tracking-[0.14em] text-[#4f46e5] sm:text-[0.85rem]">
                Theological College
              </p>
            </div>
          </div>

          <div className="text-left text-sm leading-snug text-slate-700 sm:text-right">
            <p className="font-bold uppercase tracking-wide text-neutral-950">Hebron Theological College</p>
            <p>IPC Hebron Houston · Houston, TX</p>
            <p>
              <a href={`mailto:${helpEmail}`} className="hover:text-[#4f46e5] hover:underline">
                {helpEmail}
              </a>
            </p>
            <p>
              <a
                href="https://ipchouston.com"
                target="_blank"
                rel="noreferrer"
                className="hover:text-[#4f46e5] hover:underline"
              >
                ipchouston.com
              </a>
              {helpPhone ? (
                <>
                  {" · "}
                  <a href={`tel:${helpPhone.replace(/[^\d+]/g, "")}`} className="hover:text-[#4f46e5] hover:underline">
                    {helpPhone}
                  </a>
                </>
              ) : null}
            </p>
          </div>
        </div>

        <div className="mt-8">
          <h1 className="text-[2.1rem] font-bold tracking-tight text-neutral-950 sm:text-[2.55rem]">
            {props.title}
          </h1>
          {props.subtitle ? <p className="mt-2 text-lg font-semibold text-black">{props.subtitle}</p> : null}
          {props.welcomeMessage && step === 0 ? (
            <p className="mt-4 text-base leading-relaxed text-black sm:text-lg">{props.welcomeMessage}</p>
          ) : null}
        </div>
      </header>

      <div className="mb-6">
        <div className="mb-1 flex justify-between text-sm text-slate-700">
          <span>
            {isReview ? "Review & submit" : `Step ${step + 1} of ${sections.length}`}
          </span>
          <span>{progress}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {!isReview && currentSection ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 md:p-10">
          <h2 className="text-2xl font-semibold text-neutral-950">{currentSection.title}</h2>
          {currentSection.description ? (
            <p className="mt-2 text-base text-slate-700">{currentSection.description}</p>
          ) : null}
          <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-12 md:gap-x-6 md:gap-y-6">
            {fieldsForEmbeddedSection(props.definition, currentSection.id).map((f) => renderField(f))}
          </div>
        </section>
      ) : (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 md:p-10">
          <h2 className="text-2xl font-semibold text-neutral-950">Review your application</h2>
          <p className="mt-2 text-base text-slate-700">
            Confirm your details, then submit. You will receive an email when your application is received.
          </p>
          <ul className="mt-4 space-y-2 text-base text-neutral-900">
            <li>
              <strong>Name:</strong> {String(values.fullName ?? "—")}
            </li>
            <li>
              <strong>Email:</strong> {String(values.email ?? "—")}
            </li>
            <li>
              <strong>Phone:</strong> {String(values.phone ?? "—")}
            </li>
            <li>
              <strong>Photo:</strong> {photoFile ? photoFile.name : "Missing"}
            </li>
            <li>
              <strong>Academic documents:</strong>{" "}
              {documentFiles.length > 0 ? `${documentFiles.length} file(s)` : "Missing"}
            </li>
            <li>
              <strong>Testimony:</strong>{" "}
              {String(values.personalTestimony ?? "").trim() ? "Provided" : "Missing"}
            </li>
            <li>
              <strong>Signature:</strong>{" "}
              {String(values.declarationName || values.applicantSignature || values.fullName || "—")}
            </li>
          </ul>
          {props.stripeCheckoutEnabled && props.stripeAmountCents ? (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-950">
              <p className="font-semibold">Application fee</p>
              <p className="mt-1">
                Base fee ${(props.stripeAmountCents / 100).toFixed(2)}
                {props.stripeIncludeProcessingFee !== false && props.stripeFeePreview
                  ? ` + estimated card processing $${(props.stripeFeePreview.processingCents / 100).toFixed(2)} = $${(props.stripeFeePreview.totalCents / 100).toFixed(2)} charged at checkout`
                  : ""}
                .
              </p>
              <p className="mt-1 text-xs text-amber-800">
                After you submit, you will complete payment securely with Stripe.
              </p>
            </div>
          ) : null}
          {props.confirmationMessage ? (
            <p className="mt-4 rounded-lg bg-indigo-50 px-3 py-2 text-sm text-indigo-900">
              {props.confirmationMessage}
            </p>
          ) : null}
        </section>
      )}

      {error ? (
        <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap justify-between gap-3">
        <button
          type="button"
          disabled={step === 0 || pending}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          className="rounded-md border border-slate-300 px-5 py-2.5 text-base font-medium text-slate-800 disabled:opacity-40"
        >
          Back
        </button>
        {!isReview ? (
          <button
            type="button"
            disabled={pending}
            onClick={continueToNext}
            className="rounded-md bg-indigo-600 px-5 py-2.5 text-base font-semibold text-white hover:bg-indigo-700"
          >
            Continue
          </button>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={onSubmit}
            className="rounded-md bg-indigo-600 px-5 py-2.5 text-base font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {pending ? "Submitting…" : props.stripeCheckoutEnabled ? "Submit & pay" : "Submit application"}
          </button>
        )}
      </div>

      {props.helpEmail ? (
        <p className="mt-8 text-center text-sm text-slate-700">
          Questions?{" "}
          <a href={`mailto:${props.helpEmail}`} className="hover:text-[#4f46e5] hover:underline">
            {props.helpEmail}
          </a>
        </p>
      ) : null}
    </div>
  );
}
