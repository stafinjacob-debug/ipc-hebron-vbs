"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type {
  FieldType,
  FormDefinitionV1,
  FormFieldDef,
  FormSectionDef,
} from "@/lib/registration-form-definition";
import { sortSections, fieldsForSection } from "@/lib/registration-form-definition";
import { publishRegistrationForm, saveRegistrationFormDraft } from "../../actions";

const FIELD_TYPES: FieldType[] = [
  "text",
  "textarea",
  "email",
  "tel",
  "select",
  "radio",
  "checkbox",
  "date",
  "number",
  "boolean",
  "sectionHeader",
  "staticText",
];

const AUDIENCES: FormSectionDef["audience"][] = ["guardian", "eachChild", "consent", "static"];

function newId(prefix: string) {
  const r =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID().replace(/-/g, "")
      : Math.random().toString(36).slice(2);
  return `${prefix}_${r.slice(0, 10)}`;
}

function slugKey(label: string): string {
  const base = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  const withPrefix = base && /^[a-z]/i.test(base) ? base : `field_${base || "custom"}`;
  return withPrefix.slice(0, 48);
}

function uniqueFieldKey(def: FormDefinitionV1, base: string): string {
  let k = slugKey(base) || "custom_field";
  let n = 1;
  while (def.fields.some((f) => f.key === k)) {
    k = `${slugKey(base) || "field"}_${n++}`;
  }
  return k;
}

function parseOptions(text: string): { value: string; label: string }[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const pipe = line.indexOf("|");
      if (pipe === -1) return { value: line, label: line };
      return { value: line.slice(0, pipe).trim(), label: line.slice(pipe + 1).trim() || line };
    });
}

function formatOptions(opts: { value: string; label: string }[] | undefined): string {
  if (!opts?.length) return "";
  return opts.map((o) => (o.value === o.label ? o.value : `${o.value}|${o.label}`)).join("\n");
}

export function FormDefinitionEditor({
  seasonId,
  initialDefinition,
}: {
  seasonId: string;
  initialDefinition: FormDefinitionV1;
}) {
  const router = useRouter();
  const [def, setDef] = useState<FormDefinitionV1>(initialDefinition);
  const [savedJson, setSavedJson] = useState(() => JSON.stringify(initialDefinition));
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    setDef(initialDefinition);
    setSavedJson(JSON.stringify(initialDefinition));
  }, [initialDefinition]);

  const isDirty = JSON.stringify(def) !== savedJson;

  const orderedSections = useMemo(() => sortSections(def), [def]);

  function setSections(next: FormSectionDef[]) {
    setDef((d) => ({ ...d, sections: next.map((s, i) => ({ ...s, order: i })) }));
  }

  function setFields(next: FormFieldDef[]) {
    setDef((d) => ({ ...d, fields: next }));
  }

  function moveSection(index: number, dir: -1 | 1) {
    const list = [...orderedSections];
    const j = index + dir;
    if (j < 0 || j >= list.length) return;
    [list[index], list[j]] = [list[j], list[index]];
    setSections(list);
  }

  function updateSection(id: string, patch: Partial<FormSectionDef>) {
    setSections(orderedSections.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function removeSection(id: string) {
    if (!confirm("Remove this section and all of its fields?")) return;
    setDef((d) => ({
      ...d,
      fields: d.fields.filter((f) => f.sectionId !== id),
      sections: d.sections
        .filter((s) => s.id !== id)
        .map((s, i) => ({ ...s, order: i })),
    }));
  }

  function addSection() {
    const id = newId("sec");
    setDef((d) => ({
      ...d,
      sections: [
        ...d.sections,
        {
          id,
          title: "New section",
          description: "",
          audience: "guardian" as const,
          order: d.sections.length,
        },
      ],
    }));
  }

  function moveField(sectionId: string, fieldId: string, dir: -1 | 1) {
    const inSec = fieldsForSection({ ...def, sections: def.sections }, sectionId);
    const idx = inSec.findIndex((f) => f.id === fieldId);
    if (idx < 0) return;
    const j = idx + dir;
    if (j < 0 || j >= inSec.length) return;
    const next = [...inSec];
    [next[idx], next[j]] = [next[j], next[idx]];
    const reordered = next.map((f, i) => ({ ...f, order: i }));
    const others = def.fields.filter((f) => f.sectionId !== sectionId);
    setFields([...others, ...reordered]);
  }

  function addField(sectionId: string) {
    const inSec = fieldsForSection(def, sectionId);
    const key = uniqueFieldKey(def, "new_field");
    const f: FormFieldDef = {
      id: newId("f"),
      sectionId,
      key,
      type: "text",
      label: "New field",
      required: false,
      order: inSec.length,
    };
    setFields([...def.fields, f]);
  }

  function updateField(fieldId: string, patch: Partial<FormFieldDef>) {
    setFields(def.fields.map((f) => (f.id === fieldId ? { ...f, ...patch } : f)));
  }

  function removeField(fieldId: string) {
    setFields(def.fields.filter((f) => f.id !== fieldId));
  }

  const duplicateKeys = useMemo(() => {
    const m = new Map<string, number>();
    for (const f of def.fields) {
      m.set(f.key, (m.get(f.key) ?? 0) + 1);
    }
    return new Set([...m.entries()].filter(([, c]) => c > 1).map(([k]) => k));
  }, [def.fields]);

  function saveDraft() {
    setMsg(null);
    startTransition(async () => {
      const r = await saveRegistrationFormDraft(seasonId, JSON.stringify(def));
      setMsg(r.message);
      if (r.ok) {
        setSavedJson(JSON.stringify(def));
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="sticky top-0 z-20 -mx-1 space-y-3 border-b border-foreground/10 bg-background/95 px-1 pb-4 pt-1 backdrop-blur-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Form editor</h2>
            <p className="mt-0.5 text-sm text-foreground/65">
              Draft changes; <strong className="font-medium text-foreground/80">Publish</strong> pushes to parents.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/registrations/forms/${seasonId}/preview`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-foreground/15 px-3 py-2 text-sm font-medium text-foreground/90 hover:bg-foreground/[0.05]"
            >
              Preview
            </Link>
            <button
              type="button"
              disabled={pending}
              onClick={saveDraft}
              className="rounded-lg border border-foreground/20 bg-foreground/[0.04] px-3 py-2 text-sm font-semibold text-foreground hover:bg-foreground/[0.08] disabled:opacity-50"
            >
              {pending ? "Saving…" : "Save draft"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (duplicateKeys.size > 0) {
                  setMsg("Fix duplicate field keys before publishing.");
                  return;
                }
                setMsg(null);
                startTransition(async () => {
                  const save = await saveRegistrationFormDraft(seasonId, JSON.stringify(def));
                  if (!save.ok) {
                    setMsg(save.message);
                    return;
                  }
                  setSavedJson(JSON.stringify(def));
                  const pub = await publishRegistrationForm(seasonId);
                  setMsg(pub.message);
                  if (pub.ok) router.refresh();
                });
              }}
              className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 dark:bg-emerald-700 dark:hover:bg-emerald-600"
            >
              Publish
            </button>
          </div>
        </div>
        {isDirty ? (
          <p className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-300">
            <span className="inline-block size-2 rounded-full bg-amber-500" aria-hidden />
            Unsaved changes — save your draft before leaving this page.
          </p>
        ) : null}
      </div>
      {duplicateKeys.size > 0 ? (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100">
          Duplicate keys (must be unique): {[...duplicateKeys].join(", ")}
        </p>
      ) : null}
      {msg ? <p className="text-sm text-foreground/80">{msg}</p> : null}

      <button
        type="button"
        onClick={addSection}
        className="rounded-md border border-dashed border-foreground/25 px-3 py-2 text-sm font-medium hover:bg-foreground/[0.04]"
      >
        + Add section
      </button>

      {orderedSections.map((sec, si) => (
        <section key={sec.id} className="rounded-xl border border-foreground/10 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-foreground/10 pb-3">
            <div className="grid flex-1 gap-2 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-foreground/70">Section title</label>
                <input
                  value={sec.title}
                  onChange={(e) => updateSection(sec.id, { title: e.target.value })}
                  className="mt-1 w-full rounded-md border border-foreground/15 bg-background px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-foreground/70">Audience</label>
                <select
                  value={sec.audience}
                  onChange={(e) =>
                    updateSection(sec.id, { audience: e.target.value as FormSectionDef["audience"] })
                  }
                  className="mt-1 w-full rounded-md border border-foreground/15 bg-background px-2 py-1.5 text-sm"
                >
                  {AUDIENCES.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-foreground/70">Description</label>
                <input
                  value={sec.description ?? ""}
                  onChange={(e) => updateSection(sec.id, { description: e.target.value })}
                  className="mt-1 w-full rounded-md border border-foreground/15 bg-background px-2 py-1.5 text-sm"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                className="rounded border border-foreground/15 px-2 py-1 text-xs"
                onClick={() => moveSection(si, -1)}
              >
                ↑
              </button>
              <button
                type="button"
                className="rounded border border-foreground/15 px-2 py-1 text-xs"
                onClick={() => moveSection(si, 1)}
              >
                ↓
              </button>
              <button
                type="button"
                className="rounded border border-red-500/30 px-2 py-1 text-xs text-red-700 dark:text-red-300"
                onClick={() => removeSection(sec.id)}
              >
                Remove
              </button>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {fieldsForSection(def, sec.id).map((f) => (
              <details
                key={f.id}
                className="rounded-lg border border-foreground/10 bg-foreground/[0.02] px-3 py-2"
              >
                <summary className="cursor-pointer text-sm font-medium">
                  {f.label}{" "}
                  <span className="font-normal text-foreground/60">
                    ({f.key}, {f.type})
                  </span>
                </summary>
                <div className="mt-3 grid gap-2 border-t border-foreground/10 pt-3 sm:grid-cols-2">
                  <div>
                    <label className="text-xs text-foreground/70">Label</label>
                    <input
                      value={f.label}
                      onChange={(e) => updateField(f.id, { label: e.target.value })}
                      className="mt-1 w-full rounded-md border border-foreground/15 bg-background px-2 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-foreground/70">Internal key</label>
                    <input
                      value={f.key}
                      onChange={(e) => updateField(f.id, { key: e.target.value })}
                      className="mt-1 w-full rounded-md border border-foreground/15 bg-background px-2 py-1.5 font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-foreground/70">Type</label>
                    <select
                      value={f.type}
                      onChange={(e) => updateField(f.id, { type: e.target.value as FieldType })}
                      className="mt-1 w-full rounded-md border border-foreground/15 bg-background px-2 py-1.5 text-sm"
                    >
                      {FIELD_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={f.required}
                      onChange={(e) => updateField(f.id, { required: e.target.checked })}
                    />
                    Required
                  </label>
                  <div className="sm:col-span-2">
                    <label className="text-xs text-foreground/70">Placeholder</label>
                    <input
                      value={f.placeholder ?? ""}
                      onChange={(e) => updateField(f.id, { placeholder: e.target.value || undefined })}
                      className="mt-1 w-full rounded-md border border-foreground/15 bg-background px-2 py-1.5 text-sm"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs text-foreground/70">Helper text</label>
                    <input
                      value={f.helperText ?? ""}
                      onChange={(e) => updateField(f.id, { helperText: e.target.value || undefined })}
                      className="mt-1 w-full rounded-md border border-foreground/15 bg-background px-2 py-1.5 text-sm"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs text-foreground/70">Default value</label>
                    <input
                      value={f.defaultValue ?? ""}
                      onChange={(e) => updateField(f.id, { defaultValue: e.target.value || undefined })}
                      className="mt-1 w-full rounded-md border border-foreground/15 bg-background px-2 py-1.5 text-sm"
                    />
                  </div>
                  {(f.type === "select" || f.type === "radio") && (
                    <div className="sm:col-span-2">
                      <label className="text-xs text-foreground/70">
                        Options (one per line, optional <code>value|Label</code>)
                      </label>
                      <textarea
                        rows={4}
                        value={formatOptions(f.options)}
                        onChange={(e) =>
                          updateField(f.id, {
                            options: parseOptions(e.target.value),
                          })
                        }
                        className="mt-1 w-full rounded-md border border-foreground/15 bg-background px-2 py-1.5 font-mono text-xs"
                      />
                    </div>
                  )}
                  <div className="sm:col-span-2 rounded-md bg-foreground/[0.04] p-2">
                    <p className="text-xs font-medium text-foreground/70">Conditional visibility (optional)</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <input
                        placeholder="Other field key"
                        value={f.showWhen?.fieldKey ?? ""}
                        onChange={(e) =>
                          updateField(f.id, {
                            showWhen: e.target.value
                              ? {
                                  fieldKey: e.target.value,
                                  equals: f.showWhen?.equals ?? "",
                                }
                              : undefined,
                          })
                        }
                        className="min-w-[140px] flex-1 rounded-md border border-foreground/15 bg-background px-2 py-1.5 text-sm"
                      />
                      <input
                        placeholder="Equals value"
                        value={f.showWhen?.equals ?? ""}
                        onChange={(e) =>
                          updateField(f.id, {
                            showWhen:
                              f.showWhen?.fieldKey && e.target.value !== undefined
                                ? { fieldKey: f.showWhen.fieldKey, equals: e.target.value }
                                : f.showWhen?.fieldKey
                                  ? { fieldKey: f.showWhen.fieldKey, equals: "" }
                                  : undefined,
                          })
                        }
                        className="min-w-[120px] flex-1 rounded-md border border-foreground/15 bg-background px-2 py-1.5 text-sm"
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 sm:col-span-2">
                    <button
                      type="button"
                      className="rounded border border-foreground/15 px-2 py-1 text-xs"
                      onClick={() => moveField(sec.id, f.id, -1)}
                    >
                      Move up
                    </button>
                    <button
                      type="button"
                      className="rounded border border-foreground/15 px-2 py-1 text-xs"
                      onClick={() => moveField(sec.id, f.id, 1)}
                    >
                      Move down
                    </button>
                    <button
                      type="button"
                      className="rounded border border-red-500/30 px-2 py-1 text-xs text-red-700 dark:text-red-300"
                      onClick={() => removeField(f.id)}
                    >
                      Delete field
                    </button>
                  </div>
                </div>
              </details>
            ))}
          </div>

          <button
            type="button"
            onClick={() => addField(sec.id)}
            className="mt-3 text-sm font-medium text-brand underline"
          >
            + Add field in this section
          </button>
        </section>
      ))}
    </div>
  );
}
