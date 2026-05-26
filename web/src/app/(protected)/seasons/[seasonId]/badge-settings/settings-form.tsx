"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import type { BadgeFormFieldSelection, ResolvedBadgePrintSettings } from "@/lib/badge-print";
import {
  BADGE_HORIZONTAL_LAYOUT_OPTIONS,
  badgeLabelSizeOptions,
  sampleBadgePreviewPayload,
} from "@/lib/badge-print";
import type { ExportFieldOption } from "@/lib/registration-export";
import { BadgeFormFieldsPicker } from "@/components/badge-print/badge-form-fields-picker";
import { BadgePreviewCard } from "@/components/badge-print/badge-preview-card";
import { saveBadgePrintSettings, type SaveBadgePrintSettingsState } from "./actions";

type Props = {
  seasonId: string;
  settings: ResolvedBadgePrintSettings;
  formFieldOptions: ExportFieldOption[];
};

const initial: SaveBadgePrintSettingsState | null = null;

function FieldCheckbox({
  name,
  label,
  description,
  checked,
  onChange,
}: {
  name: string;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer gap-3 rounded-lg border border-foreground/10 px-3 py-2.5 hover:bg-foreground/[0.02]">
      <input
        type="checkbox"
        name={name}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5"
      />
      <span>
        <span className="block text-sm font-medium text-foreground">{label}</span>
        {description ? <span className="mt-0.5 block text-xs text-muted">{description}</span> : null}
      </span>
    </label>
  );
}

export function BadgePrintSettingsForm({ seasonId, settings, formFieldOptions }: Props) {
  const [state, action, pending] = useActionState(
    saveBadgePrintSettings.bind(null, seasonId),
    initial,
  );

  const [draft, setDraft] = useState<ResolvedBadgePrintSettings>(settings);
  const [formFields, setFormFields] = useState<BadgeFormFieldSelection[]>(settings.formFields);
  const [logoPreview, setLogoPreview] = useState<string | null>(settings.logoUrl);

  const previewSettings = useMemo(
    () => ({ ...draft, formFields, logoUrl: logoPreview }),
    [draft, formFields, logoPreview],
  );
  const previewPayload = useMemo(
    () => sampleBadgePreviewPayload(previewSettings, formFieldOptions),
    [previewSettings, formFieldOptions],
  );

  function patchDraft(patch: Partial<ResolvedBadgePrintSettings>) {
    setDraft((prev) => ({ ...prev, ...patch }));
  }

  function handleLogoChange(file: File | null) {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setLogoPreview(url);
  }

  return (
    <form action={action} encType="multipart/form-data" className="max-w-2xl space-y-8">
      <input type="hidden" name="customFieldsJson" value={JSON.stringify(formFields)} readOnly />

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
          <FieldCheckbox
            name="enabled"
            label="Enable badge printing"
            checked={draft.enabled}
            onChange={(enabled) => patchDraft({ enabled })}
          />
          <FieldCheckbox
            name="autoPrintOnCheckIn"
            label="Auto-print when checking in"
            description="Opens the print dialog immediately after staff tap Check in (iPad must be paired to the thermal printer)."
            checked={draft.autoPrintOnCheckIn}
            onChange={(autoPrintOnCheckIn) => patchDraft({ autoPrintOnCheckIn })}
          />
        </div>
      </div>

      <div className="rounded-xl border border-foreground/10 p-4">
        <h2 className="text-sm font-semibold text-foreground/90">Label size & orientation</h2>
        <p className="mt-1 text-sm text-muted">
          Match your physical label stock. Horizontal swaps width and height and lays out text beside the QR code.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="labelSize" className="block text-xs font-medium text-foreground/70">
              Label size
            </label>
            <select
              id="labelSize"
              name="labelSize"
              value={draft.labelSize}
              onChange={(e) =>
                patchDraft({
                  labelSize: e.target.value as ResolvedBadgePrintSettings["labelSize"],
                })
              }
              className="mt-1 w-full rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm"
            >
              {badgeLabelSizeOptions().map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <span className="block text-xs font-medium text-foreground/70">Print orientation</span>
            <div className="mt-2 flex flex-col gap-2">
              <label className="flex cursor-pointer items-center gap-2 rounded-md border border-foreground/10 px-3 py-2 text-sm">
                <input
                  type="radio"
                  name="orientation"
                  value="VERTICAL"
                  checked={draft.orientation === "VERTICAL"}
                  onChange={() => patchDraft({ orientation: "VERTICAL" })}
                />
                Vertical (tall badge)
              </label>
              <label className="flex cursor-pointer items-center gap-2 rounded-md border border-foreground/10 px-3 py-2 text-sm">
                <input
                  type="radio"
                  name="orientation"
                  value="HORIZONTAL"
                  checked={draft.orientation === "HORIZONTAL"}
                  onChange={() => patchDraft({ orientation: "HORIZONTAL" })}
                />
                Horizontal (wide badge)
              </label>
            </div>
          </div>
        </div>
        {draft.orientation === "HORIZONTAL" ? (
          <div className="mt-4 border-t border-foreground/10 pt-4">
            <span className="block text-xs font-medium text-foreground/70">Horizontal layout</span>
            <p className="mt-1 text-xs text-muted">
              Choose how fields are arranged on wide labels. Preview updates below.
            </p>
            <div className="mt-3 space-y-2">
              {BADGE_HORIZONTAL_LAYOUT_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className="flex cursor-pointer gap-3 rounded-md border border-foreground/10 px-3 py-2.5 hover:bg-foreground/[0.02]"
                >
                  <input
                    type="radio"
                    name="horizontalLayout"
                    value={opt.value}
                    checked={draft.horizontalLayout === opt.value}
                    onChange={() => patchDraft({ horizontalLayout: opt.value })}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="block text-sm font-medium text-foreground">{opt.label}</span>
                    <span className="mt-0.5 block text-xs text-muted">{opt.description}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        ) : (
          <input type="hidden" name="horizontalLayout" value={draft.horizontalLayout} readOnly />
        )}
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
          <FieldCheckbox
            name="showSeasonName"
            label="Season name"
            checked={draft.showSeasonName}
            onChange={(showSeasonName) => patchDraft({ showSeasonName })}
          />
          <FieldCheckbox
            name="showChildName"
            label="Child name"
            checked={draft.showChildName}
            onChange={(showChildName) => patchDraft({ showChildName })}
          />
          <FieldCheckbox
            name="showRegistrationNumber"
            label="Registration number"
            checked={draft.showRegistrationNumber}
            onChange={(showRegistrationNumber) => patchDraft({ showRegistrationNumber })}
          />
          <FieldCheckbox
            name="showBadgeDisplayName"
            label="Class badge display name"
            description="Uses badge display name when set; otherwise classroom name."
            checked={draft.showBadgeDisplayName}
            onChange={(showBadgeDisplayName) => patchDraft({ showBadgeDisplayName })}
          />
          <FieldCheckbox
            name="showClassroomName"
            label="Classroom name"
            description="Shown when badge display name is empty."
            checked={draft.showClassroomName}
            onChange={(showClassroomName) => patchDraft({ showClassroomName })}
          />
          <FieldCheckbox
            name="showCheckInLabel"
            label="Check-in label"
            checked={draft.showCheckInLabel}
            onChange={(showCheckInLabel) => patchDraft({ showCheckInLabel })}
          />
          <FieldCheckbox
            name="showQrCode"
            label="Check-in QR code"
            checked={draft.showQrCode}
            onChange={(showQrCode) => patchDraft({ showQrCode })}
          />
          <FieldCheckbox
            name="showAllergyFlag"
            label="Allergies on file (flag only)"
            description='Prints "Allergies on file" — not full medical notes.'
            checked={draft.showAllergyFlag}
            onChange={(showAllergyFlag) => patchDraft({ showAllergyFlag })}
          />
        </div>
      </div>

      <div className="rounded-xl border border-foreground/10 p-4">
        <h2 className="text-sm font-semibold text-foreground/90">Registration form fields</h2>
        <p className="mt-1 text-sm text-muted">
          Pull additional answers from your published registration form onto each badge — values come from
          each child&apos;s submission at print time.
        </p>
        <div className="mt-4">
          <BadgeFormFieldsPicker
            fields={formFields}
            options={formFieldOptions}
            onChange={setFormFields}
          />
        </div>
      </div>

      <div className="rounded-xl border border-foreground/10 p-4">
        <h2 className="text-sm font-semibold text-foreground/90">Badge logo</h2>
        <p className="mt-1 text-sm text-muted">Upload a small image for the top of each badge (JPEG, PNG, WebP, or GIF).</p>
        {logoPreview ? (
          <div className="mt-4 flex items-start gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoPreview} alt="Current logo" className="max-h-16 max-w-[120px] rounded border object-contain" />
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" name="removeLogo" className="rounded" />
              Remove logo on save
            </label>
          </div>
        ) : null}
        <div className="mt-4">
          <label htmlFor="logoImage" className="block text-xs font-medium text-foreground/70">
            {logoPreview ? "Replace logo" : "Upload logo"}
          </label>
          <input
            id="logoImage"
            name="logoImage"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={(e) => handleLogoChange(e.target.files?.[0] ?? null)}
            className="mt-1 block w-full text-sm text-foreground/80 file:mr-3 file:rounded-md file:border-0 file:bg-brand file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand-foreground"
          />
        </div>
      </div>

      <div className="rounded-xl border border-foreground/10 p-4">
        <h2 className="text-sm font-semibold text-foreground/90">Preview</h2>
        <p className="mt-1 text-sm text-muted">Live preview of your layout. Save to apply at the check-in desk.</p>
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
