"use client";

import { Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import {
  DEFAULT_BADGE_FORM_FIELD_FONT_PT,
  type BadgeFormFieldSelection,
} from "@/lib/badge-print";
import type { ExportFieldOption } from "@/lib/registration-export";

type Props = {
  fields: BadgeFormFieldSelection[];
  options: ExportFieldOption[];
  onChange: (fields: BadgeFormFieldSelection[]) => void;
  /** Default pt size when adding a new field. */
  defaultFontPt?: number;
  /** Show per-field font size controls (horizontal Brother badges). */
  showFontSizeControls?: boolean;
};

function newSelection(fieldKey: string, fontPt: number): BadgeFormFieldSelection {
  const id =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? `field-${crypto.randomUUID().slice(0, 8)}`
      : `field-${Date.now()}`;
  return { id, fieldKey, fontPt };
}

export function BadgeFormFieldsPicker({
  fields,
  options,
  onChange,
  defaultFontPt = DEFAULT_BADGE_FORM_FIELD_FONT_PT,
  showFontSizeControls = true,
}: Props) {
  const selectedKeys = new Set(fields.map((f) => f.fieldKey));
  const available = options.filter((o) => !selectedKeys.has(o.key));

  function labelFor(fieldKey: string): string {
    return options.find((o) => o.key === fieldKey)?.label ?? fieldKey;
  }

  function addField(fieldKey: string) {
    if (!fieldKey || selectedKeys.has(fieldKey) || fields.length >= 12) return;
    onChange([...fields, newSelection(fieldKey, defaultFontPt)]);
  }

  function remove(id: string) {
    onChange(fields.filter((f) => f.id !== id));
  }

  function patchField(id: string, patch: Partial<BadgeFormFieldSelection>) {
    onChange(fields.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }

  if (options.length === 0) {
    return (
      <p className="text-sm text-muted">
        No registration form fields found for this season. Publish a form under{" "}
        <Link href="/registrations/forms" className="font-medium text-brand underline">
          Registration forms
        </Link>{" "}
        first, then return here to pick fields for badges.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {fields.length === 0 ? (
        <p className="text-sm text-muted">
          Add answers from your registration form — guardian phone, custom child questions, and more.
          In KidCheck or Name + code layouts, guardian and birthdate appear only when you add those
          fields here.
        </p>
      ) : (
        <ul className="space-y-2">
          {fields.map((field, index) => (
            <li
              key={field.id}
              className="rounded-lg border border-foreground/10 bg-foreground/[0.02] px-3 py-2.5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                    Field {index + 1}
                  </span>
                  <p className="text-sm font-medium text-foreground">{labelFor(field.fieldKey)}</p>
                </div>
                {showFontSizeControls ? (
                  <div className="w-28 shrink-0">
                    <label
                      htmlFor={`badge-field-font-${field.id}`}
                      className="block text-xs font-medium text-foreground/70"
                    >
                      Font size
                    </label>
                    <div className="mt-1 flex items-center gap-1.5">
                      <input
                        id={`badge-field-font-${field.id}`}
                        type="number"
                        min={6}
                        max={24}
                        step={1}
                        value={field.fontPt}
                        onChange={(e) =>
                          patchField(field.id, {
                            fontPt: Number.parseFloat(e.target.value) || defaultFontPt,
                          })
                        }
                        className="w-full rounded-md border border-foreground/15 bg-background px-2 py-1.5 text-sm tabular-nums"
                      />
                      <span className="text-xs text-muted">pt</span>
                    </div>
                  </div>
                ) : null}
                <button
                  type="button"
                  onClick={() => remove(field.id)}
                  className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-500/10"
                >
                  <Trash2 className="size-3.5" aria-hidden />
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[220px] flex-1">
          <label htmlFor="badgeFormFieldAdd" className="block text-xs font-medium text-foreground/70">
            Add registration form field
          </label>
          <select
            id="badgeFormFieldAdd"
            defaultValue=""
            disabled={available.length === 0 || fields.length >= 12}
            onChange={(e) => {
              const key = e.target.value;
              if (key) {
                addField(key);
                e.target.value = "";
              }
            }}
            className="mt-1 w-full rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm disabled:opacity-50"
          >
            <option value="">Choose a field…</option>
            {available.map((opt) => (
              <option key={opt.key} value={opt.key}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        {available.length > 0 && fields.length < 12 ? (
          <button
            type="button"
            onClick={() => addField(available[0]!.key)}
            className="inline-flex items-center gap-2 rounded-lg border border-foreground/15 px-3 py-2 text-sm font-medium hover:bg-foreground/5"
          >
            <Plus className="size-4" aria-hidden />
            Add field
          </button>
        ) : null}
      </div>

      {fields.length >= 12 ? (
        <p className="text-xs text-muted">Maximum of 12 registration form fields on a badge.</p>
      ) : null}
    </div>
  );
}
