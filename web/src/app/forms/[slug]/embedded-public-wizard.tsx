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
  parseEducationEntries,
  type EducationEntry,
  type EmbeddedFormDefinitionV1,
  type EmbeddedFormFieldDef,
} from "@/lib/embedded-form-definition";
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
      return next;
    });
  }

  function renderField(field: EmbeddedFormFieldDef) {
    if (!fieldIsVisible(field, values)) return null;
    if (!isFillableEmbeddedField(field) && field.type !== "staticText" && field.type !== "declaration") {
      return null;
    }

    const err = fieldErrors[field.key];
    const commonLabel = (
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
        {field.label}
        {field.required ? <span className="text-rose-600"> *</span> : null}
      </span>
    );

    if (field.type === "staticText") {
      return (
        <div key={field.id} className="md:col-span-12 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          <p className="font-semibold text-slate-900">{field.label}</p>
          {field.helperText ? <p className="mt-2 whitespace-pre-wrap leading-relaxed">{field.helperText}</p> : null}
        </div>
      );
    }

    if (field.type === "photo") {
      return (
        <div key={field.id} className="md:col-span-12">
          {commonLabel}
          <div className="flex flex-wrap items-start gap-4">
            <label className="flex h-40 w-32 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-indigo-300 bg-indigo-50/40 text-center text-xs text-indigo-700">
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
            {field.helperText ? <p className="max-w-sm text-xs text-slate-500">{field.helperText}</p> : null}
          </div>
          {err ? <p className="mt-1 text-xs text-rose-600">{err}</p> : null}
        </div>
      );
    }

    if (field.type === "documentUploads") {
      const maxFiles = field.validation?.max ?? 5;
      return (
        <div key={field.id} className="md:col-span-12 space-y-2">
          {commonLabel}
          {field.helperText ? <p className="text-xs text-slate-500">{field.helperText}</p> : null}
          <label className="flex cursor-pointer flex-col items-start gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/40">
            <span className="font-semibold text-indigo-700">Choose academic documents</span>
            <span className="text-xs text-slate-500">PDF or images · up to {maxFiles} files · 5 MB each</span>
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
            <ul className="space-y-1 text-sm text-slate-700">
              {documentFiles.map((file) => (
                <li key={`${file.name}-${file.size}`} className="rounded-md bg-white px-3 py-1.5 border border-slate-200">
                  {file.name}{" "}
                  <span className="text-xs text-slate-450 text-slate-500">
                    ({Math.round(file.size / 1024)} KB)
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          {documentFiles.length > 0 ? (
            <button
              type="button"
              className="text-xs font-medium text-rose-600 hover:underline"
              onClick={() => setDocumentFiles([])}
            >
              Clear documents
            </button>
          ) : null}
          {err ? <p className="text-xs text-rose-600">{err}</p> : null}
        </div>
      );
    }

    if (field.type === "radio") {
      return (
        <fieldset key={field.id} className={widthClass(field.layout?.width)}>
          {commonLabel}
          <div className="flex flex-wrap gap-4 pt-1">
            {(field.options ?? []).map((opt) => (
              <label key={opt.value} className="inline-flex items-center gap-2 text-sm text-slate-800">
                <input
                  type="radio"
                  name={field.key}
                  value={opt.value}
                  checked={values[field.key] === opt.value}
                  onChange={() => setValue(field.key, opt.value)}
                />
                {opt.label}
              </label>
            ))}
          </div>
          {err ? <p className="mt-1 text-xs text-rose-600">{err}</p> : null}
        </fieldset>
      );
    }

    if (field.type === "checkboxGroup") {
      const selected = Array.isArray(values[field.key]) ? (values[field.key] as string[]) : [];
      return (
        <fieldset key={field.id} className="md:col-span-12">
          {commonLabel}
          <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {(field.options ?? []).map((opt) => {
              const checked = selected.includes(opt.value);
              return (
                <label key={opt.value} className="inline-flex items-start gap-2 text-sm text-slate-800">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      const next = checked
                        ? selected.filter((v) => v !== opt.value)
                        : [...selected, opt.value];
                      setValue(field.key, next);
                    }}
                  />
                  <span>{opt.label}</span>
                </label>
              );
            })}
          </div>
          {err ? <p className="mt-1 text-xs text-rose-600">{err}</p> : null}
        </fieldset>
      );
    }

    if (field.type === "educationEntries") {
      const entries = parseEducationEntries(values[field.key]);
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
          {field.helperText ? <p className="text-xs text-slate-500">{field.helperText}</p> : null}
          {entries.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-sm text-slate-500">
              No education rows yet. Add High School, Undergrad, Graduate School, or Other as needed.
            </p>
          ) : null}
          {entries.map((row, index) => (
            <div
              key={`${field.key}-${index}`}
              className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-800">Education {index + 1}</p>
                <button
                  type="button"
                  className="text-xs font-medium text-rose-600 hover:underline"
                  onClick={() => setValue(field.key, entries.filter((_, i) => i !== index))}
                >
                  Remove
                </button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm sm:col-span-2">
                  <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Description</span>
                  <select
                    value={row.description}
                    onChange={(e) => updateEntry(index, { description: e.target.value })}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
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
                <label className="block text-sm sm:col-span-2">
                  <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">
                    Name & place of institution
                  </span>
                  <input
                    value={row.institution}
                    onChange={(e) => updateEntry(index, { institution: e.target.value })}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Date of completion</span>
                  <input
                    value={row.completionDate}
                    onChange={(e) => updateEntry(index, { completionDate: e.target.value })}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Diploma / degree</span>
                  <input
                    value={row.diplomaDegree}
                    onChange={(e) => updateEntry(index, { diplomaDegree: e.target.value })}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Class / division</span>
                  <input
                    value={row.classDivision}
                    onChange={(e) => updateEntry(index, { classDivision: e.target.value })}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Passed / failed</span>
                  <select
                    value={row.passedFailed}
                    onChange={(e) => updateEntry(index, { passedFailed: e.target.value })}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
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
                  className="rounded-md border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                  onClick={() => setValue(field.key, [...entries, emptyEducationEntry(opt.value)])}
                >
                  + Add {opt.label}
                </button>
              ))}
            </div>
          ) : null}
          {err ? <p className="text-xs text-rose-600">{err}</p> : null}
        </div>
      );
    }

    if (field.type === "declaration" || field.type === "checkbox") {
      return (
        <label key={field.id} className="md:col-span-12 inline-flex items-start gap-2 text-sm text-slate-800">
          <input
            type="checkbox"
            name={field.key}
            checked={values[field.key] === "true"}
            onChange={(e) => setValue(field.key, e.target.checked ? "true" : "")}
            className="mt-1"
          />
          <span>
            {field.label}
            {field.required ? <span className="text-rose-600"> *</span> : null}
            {err ? <span className="mt-1 block text-xs text-rose-600">{err}</span> : null}
          </span>
        </label>
      );
    }

    if (field.type === "textarea") {
      return (
        <label key={field.id} className={`${widthClass(field.layout?.width)} block`}>
          {commonLabel}
          <textarea
            name={field.key}
            rows={4}
            value={String(values[field.key] ?? "")}
            onChange={(e) => setValue(field.key, e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder={field.placeholder}
          />
          {err ? <p className="mt-1 text-xs text-rose-600">{err}</p> : null}
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
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            {(field.options ?? []).map((opt) => (
              <option key={`${field.key}-${opt.value}`} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {err ? <p className="mt-1 text-xs text-rose-600">{err}</p> : null}
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
      <label key={field.id} className={`${widthClass(field.layout?.width)} block`}>
        {commonLabel}
        <input
          type={inputType}
          name={field.key}
          value={String(values[field.key] ?? "")}
          onChange={(e) => setValue(field.key, e.target.value)}
          className={`w-full rounded-md border border-slate-300 px-3 py-2 text-sm ${
            field.type === "signatureTyped" ? "font-serif italic text-lg" : ""
          }`}
          placeholder={field.placeholder}
        />
        {field.helperText ? <p className="mt-1 text-xs text-slate-500">{field.helperText}</p> : null}
        {err ? <p className="mt-1 text-xs text-rose-600">{err}</p> : null}
      </label>
    );
  }

  function onSubmit() {
    setError(null);
    setFieldErrors({});
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
        setError(result.error);
        if (result.fieldErrors) setFieldErrors(result.fieldErrors);
        return;
      }
      if (result.stripeCheckoutUrl) {
        window.location.href = result.stripeCheckoutUrl;
        return;
      }
      router.push(
        `/forms/${props.slug}/thanks?ref=${encodeURIComponent(result.applicationNumber)}`,
      );
    });
  }

  const progress = Math.round(((Math.min(step, sections.length) + (isReview ? 1 : 0)) / (sections.length + 1)) * 100);
  const helpEmail = props.helpEmail?.trim() || "admissions@ipchouston.com";
  const helpPhone = props.helpPhone?.trim() || "(713) 555-0148";

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-6 border-t-[3px] border-[#4f46e5] pt-5">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/htc-flame-logo.png"
              alt="Hebron Theological College"
              width={48}
              height={68}
              className="h-14 w-auto object-contain"
              priority
            />
            <div className="leading-tight">
              <p className="text-[1.35rem] font-extrabold tracking-wide text-slate-900 sm:text-[1.5rem]">
                HEBRON
              </p>
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-[#4f46e5] sm:text-[0.75rem]">
                Theological College
              </p>
            </div>
          </div>

          <div className="text-left text-[0.8rem] leading-snug text-slate-500 sm:text-right">
            <p className="font-bold uppercase tracking-wide text-slate-900">Hebron Theological College</p>
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
              {" · "}
              <a href={`tel:${helpPhone.replace(/[^\d+]/g, "")}`} className="hover:text-[#4f46e5] hover:underline">
                {helpPhone}
              </a>
            </p>
          </div>
        </div>

        <div className="mt-8">
          <h1 className="text-[1.85rem] font-bold tracking-tight text-slate-900 sm:text-[2.15rem]">
            {props.title}
          </h1>
          {props.subtitle ? <p className="mt-1 text-base text-slate-500">{props.subtitle}</p> : null}
          {props.welcomeMessage && step === 0 ? (
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600">{props.welcomeMessage}</p>
          ) : null}
        </div>
      </header>

      <div className="mb-6">
        <div className="mb-1 flex justify-between text-xs text-slate-500">
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
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">{currentSection.title}</h2>
          {currentSection.description ? (
            <p className="mt-1 text-sm text-slate-500">{currentSection.description}</p>
          ) : null}
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-12">
            {fieldsForEmbeddedSection(props.definition, currentSection.id).map((f) => renderField(f))}
          </div>
        </section>
      ) : (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Review your application</h2>
          <p className="mt-1 text-sm text-slate-500">
            Confirm your details, then submit. You will receive an email when your application is received.
          </p>
          <ul className="mt-4 space-y-2 text-sm text-slate-700">
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
              <strong>Signature:</strong> {String(values.applicantSignature ?? "—")}
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
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-40"
        >
          Back
        </button>
        {!isReview ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => setStep((s) => Math.min(sections.length, s + 1))}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            Continue
          </button>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={onSubmit}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {pending ? "Submitting…" : props.stripeCheckoutEnabled ? "Submit & pay" : "Submit application"}
          </button>
        )}
      </div>

      {(props.helpEmail || props.helpPhone) && (
        <p className="mt-8 text-center text-xs text-slate-500">
          Questions? {[props.helpEmail, props.helpPhone].filter(Boolean).join(" · ")}
        </p>
      )}
    </div>
  );
}
