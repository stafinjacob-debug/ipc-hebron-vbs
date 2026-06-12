"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import {
  BADGE_DETAIL_FIELD_OPTIONS,
  DEFAULT_BADGE_DETAIL_FIELD_ORDER,
  type BadgeDetailFieldId,
} from "@/lib/badge-print";

type Props = {
  order: BadgeDetailFieldId[];
  onChange: (order: BadgeDetailFieldId[]) => void;
};

function labelFor(id: BadgeDetailFieldId): { label: string; description: string } {
  return (
    BADGE_DETAIL_FIELD_OPTIONS.find((o) => o.id === id) ?? {
      label: id,
      description: "",
    }
  );
}

export function BadgeDetailFieldOrderEditor({ order, onChange }: Props) {
  function move(index: number, direction: -1 | 1) {
    const next = index + direction;
    if (next < 0 || next >= order.length) return;
    const copy = [...order];
    [copy[index], copy[next]] = [copy[next]!, copy[index]!];
    onChange(copy);
  }

  return (
    <div className="space-y-2">
      <ul className="space-y-2">
        {order.map((id, index) => {
          const meta = labelFor(id);
          return (
            <li
              key={id}
              className="flex items-start gap-2 rounded-lg border border-foreground/10 bg-foreground/[0.02] px-3 py-2.5"
            >
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-foreground/10 text-xs font-bold text-muted">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">{meta.label}</p>
                {meta.description ? (
                  <p className="mt-0.5 text-xs text-muted">{meta.description}</p>
                ) : null}
              </div>
              <div className="flex shrink-0 flex-col gap-0.5">
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                  className="rounded p-1 text-muted hover:bg-foreground/10 disabled:opacity-30"
                  aria-label={`Move ${meta.label} up`}
                >
                  <ChevronUp className="size-4" aria-hidden />
                </button>
                <button
                  type="button"
                  disabled={index === order.length - 1}
                  onClick={() => move(index, 1)}
                  className="rounded p-1 text-muted hover:bg-foreground/10 disabled:opacity-30"
                  aria-label={`Move ${meta.label} down`}
                >
                  <ChevronDown className="size-4" aria-hidden />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        onClick={() => onChange([...DEFAULT_BADGE_DETAIL_FIELD_ORDER])}
        className="text-sm font-medium text-brand underline-offset-4 hover:underline"
      >
        Reset field order to defaults
      </button>
    </div>
  );
}
