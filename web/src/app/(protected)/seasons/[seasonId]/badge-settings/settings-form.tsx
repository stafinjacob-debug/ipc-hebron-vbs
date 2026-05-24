"use client";

import { useActionState, useMemo } from "react";
import Link from "next/link";
import type { ResolvedBadgePrintSettings } from "@/lib/badge-print";
import { badgeLabelSizeOptions, sampleBadgePreviewPayload } from "@/lib/badge-print";
import { BadgePreviewCard } from "@/components/badge-print/badge-preview-card";
import { saveBadgePrintSettings, type SaveBadgePrintSettingsState } from "./actions";

type Props = {
  seasonId: string;
  settings: ResolvedBadgePrintSettings;
};

const initial: SaveBadgePrintSettingsState | null = null;

function FieldCheckbox({
  name,
  label,
  description,
  defaultChecked,
}: {
  name: string;
  label: string;
  description?: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex cursor-pointer gap-3 rounded-lg border border-foreground/10 px-3 py-2.5 hover:bg-foreground/[0.02]">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="mt-0.5" />
      <span>
        <span className="block text-sm font-medium text-foreground">{label}</span>
        {description ? <span className="mt-0.5 block text-xs text-muted">{description}</span> : null}
      </span>
    </label>
  );
}

export function BadgePrintSettingsForm({ seasonId, settings }: Props) {
  const [state, action, pending] = useActionState(
    saveBadgePrintSettings.bind(null, seasonId),
    initial,
  );

  const previewPayload = useMemo(() => sampleBadgePreviewPayload(settings), [settings]);

  return (
    <form action={action} className="max-w-2xl space-y-8">
      {state?.message ? (
        <div
          className={
            state.ok
              ? "rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200"
              : "rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-800 dark:text-red-200"
          }
        >
          {state.message}
        </div>
      ) : null}

      <div className="rounded-xl border border-foreground/10 p-4">
        <h2 className="text-sm font-semibold text-foreground/90">General</h2>
        <p className="mt-1 text-sm text-muted">
          Control whether volunteers can print thermal badges from the check-in desk on iPads.
        </p>
        <div className="mt-4 space-y-3">
          <FieldCheckbox name="enabled" label="Enable badge printing" defaultChecked={settings.enabled} />
          <FieldCheckbox
            name="autoPrintOnCheckIn"
            label="Auto-print when checking in"
            description="Opens the print dialog immediately after staff tap Check in (iPad must be paired to the thermal printer)."
            defaultChecked={settings.autoPrintOnCheckIn}
          />
        </div>
      </div>

      <div className="rounded-xl border border-foreground/10 p-4">
        <h2 className="text-sm font-semibold text-foreground/90">Label size</h2>
        <p className="mt-1 text-sm text-muted">Match your physical label stock.</p>
        <select
          name="labelSize"
          defaultValue={settings.labelSize}
          className="mt-4 w-full rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm"
        >
          {badgeLabelSizeOptions().map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-xl border border-foreground/10 p-4">
        <h2 className="text-sm font-semibold text-foreground/90">Fields to print</h2>
        <p className="mt-1 text-sm text-muted">
          Classroom badge and check-in labels are set per class under{" "}
          <Link href="/classes" className="font-medium text-brand underline">
            Classes
          </Link>
          .
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <FieldCheckbox name="showSeasonName" label="Season name" defaultChecked={settings.showSeasonName} />
          <FieldCheckbox name="showChildName" label="Child name" defaultChecked={settings.showChildName} />
          <FieldCheckbox
            name="showRegistrationNumber"
            label="Registration number"
            defaultChecked={settings.showRegistrationNumber}
          />
          <FieldCheckbox
            name="showBadgeDisplayName"
            label="Class badge display name"
            description="Uses badge display name when set; otherwise classroom name."
            defaultChecked={settings.showBadgeDisplayName}
          />
          <FieldCheckbox
            name="showClassroomName"
            label="Classroom name"
            description="Shown when badge display name is empty."
            defaultChecked={settings.showClassroomName}
          />
          <FieldCheckbox name="showCheckInLabel" label="Check-in label" defaultChecked={settings.showCheckInLabel} />
          <FieldCheckbox
            name="showQrCode"
            label="Check-in QR code"
            defaultChecked={settings.showQrCode}
          />
          <FieldCheckbox
            name="showAllergyFlag"
            label="Allergies on file (flag only)"
            description='Prints "Allergies on file" — not full medical notes.'
            defaultChecked={settings.showAllergyFlag}
          />
        </div>
      </div>

      <div className="rounded-xl border border-foreground/10 p-4">
        <h2 className="text-sm font-semibold text-foreground/90">Optional logo</h2>
        <p className="mt-1 text-sm text-muted">Small image at the top of each badge (HTTPS URL or /uploads/… path).</p>
        <input
          type="url"
          name="logoUrl"
          defaultValue={settings.logoUrl ?? ""}
          placeholder="https://… or /uploads/…"
          className="mt-4 w-full rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm"
        />
      </div>

      <div className="rounded-xl border border-foreground/10 p-4">
        <h2 className="text-sm font-semibold text-foreground/90">Preview</h2>
        <p className="mt-1 text-sm text-muted">Sample layout with the current saved settings. Save to apply changes.</p>
        <div className="mt-4 flex justify-center rounded-lg bg-foreground/[0.03] p-6">
          <BadgePreviewCard payload={previewPayload} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-foreground hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save badge settings"}
        </button>
        <Link href="/seasons" className="text-sm font-medium text-brand underline-offset-4 hover:underline">
          Back to seasons
        </Link>
      </div>
    </form>
  );
}
