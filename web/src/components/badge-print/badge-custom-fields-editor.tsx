"use client";

import { Plus, Trash2 } from "lucide-react";
import type { BadgeCustomField } from "@/lib/badge-print";

type Props = {
  fields: BadgeCustomField[];
  onChange: (fields: BadgeCustomField[]) => void;
};

function newField(): BadgeCustomField {
  const id =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? `custom-${crypto.randomUUID().slice(0, 8)}`
      : `custom-${Date.now()}`;
  return { id, label: "", text: "" };
}

export function BadgeCustomFieldsEditor({ fields, onChange }: Props) {
  function update(id: string, patch: Partial<BadgeCustomField>) {
    onChange(fields.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }

  function remove(id: string) {
    onChange(fields.filter((f) => f.id !== id));
  }

  return (
    <div className="space-y-3">
      {fields.length === 0 ? (
        <p className="text-sm text-muted">No custom fields yet. Add lines such as a church name, room note, or event tag.</p>
      ) : null}
      {fields.map((field, index) => (
        <div
          key={field.id}
          className="rounded-lg border border-foreground/10 bg-foreground/[0.02] p-3"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted">
              Custom field {index + 1}
            </span>
            <button
              type="button"
              onClick={() => remove(field.id)}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-500/10"
            >
              <Trash2 className="size-3.5" aria-hidden />
              Remove
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-foreground/70">Label (optional)</label>
              <input
                type="text"
                value={field.label}
                onChange={(e) => update(field.id, { label: e.target.value })}
                placeholder="e.g. Group"
                className="mt-1 w-full rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground/70">Text to print</label>
              <input
                type="text"
                value={field.text}
                onChange={(e) => update(field.id, { text: e.target.value })}
                placeholder="e.g. IPC Hebron"
                className="mt-1 w-full rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...fields, newField()])}
        disabled={fields.length >= 12}
        className="inline-flex items-center gap-2 rounded-lg border border-foreground/15 px-3 py-2 text-sm font-medium hover:bg-foreground/5 disabled:opacity-50"
      >
        <Plus className="size-4" aria-hidden />
        Add custom field
      </button>
      {fields.length >= 12 ? (
        <p className="text-xs text-muted">Maximum of 12 custom fields.</p>
      ) : null}
    </div>
  );
}
