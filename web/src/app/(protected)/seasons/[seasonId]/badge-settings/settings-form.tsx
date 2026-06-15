"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { BadgeFormFieldSelection, BadgeTypographySettings, ResolvedBadgePrintSettings } from "@/lib/badge-print";
import {
  BADGE_HORIZONTAL_LAYOUT_OPTIONS,
  badgeLabelSizeOptions,
  DEFAULT_BADGE_TYPOGRAPHY,
  sampleBadgePreviewPayload,
} from "@/lib/badge-print";
import type { ExportFieldOption } from "@/lib/registration-export";
import { BadgeDetailFieldOrderEditor } from "@/components/badge-print/badge-detail-field-order";
import { BadgeFormFieldsPicker } from "@/components/badge-print/badge-form-fields-picker";
import { BadgePreviewCard } from "@/components/badge-print/badge-preview-card";
import { saveBadgePrintSettings, type SaveBadgePrintSettingsState } from "./actions";

type Props = {
  seasonId: string;
  seasonName: string;
  seasonYear: number;
  registrationNumberPrefix: string | null;
  registrationNumberSeqDigits: number;
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

function TypographyNumberField({
  label,
  description,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  description?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-foreground/70">{label}</label>
      {description ? <p className="mt-0.5 text-[11px] text-muted">{description}</p> : null}
      <div className="mt-1 flex items-center gap-2">
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number.parseFloat(e.target.value))}
          className="w-full rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm tabular-nums"
        />
        <span className="shrink-0 text-xs text-muted">{unit}</span>
      </div>
    </div>
  );
}

export function BadgePrintSettingsForm({
  seasonId,
  seasonName,
  seasonYear,
  registrationNumberPrefix,
  registrationNumberSeqDigits,
  settings,
  formFieldOptions,
}: Props) {
  const [state, action, pending] = useActionState(
    saveBadgePrintSettings.bind(null, seasonId),
    initial,
  );

  const [draft, setDraft] = useState<ResolvedBadgePrintSettings>(settings);
  const [formFields, setFormFields] = useState<BadgeFormFieldSelection[]>(settings.formFields);
  const [typography, setTypography] = useState<BadgeTypographySettings>(settings.typography);
  const [logoPreview, setLogoPreview] = useState<string | null>(settings.logoUrl);

  const previewSettings = useMemo(
    () => ({ ...draft, formFields, logoUrl: logoPreview, typography }),
    [draft, formFields, logoPreview, typography],
  );
  const previewPayload = useMemo(
    () =>
      sampleBadgePreviewPayload(previewSettings, formFieldOptions, {
        seasonName,
        seasonYear,
        registrationNumberPrefix,
        registrationNumberSeqDigits,
      }),
    [
      previewSettings,
      formFieldOptions,
      seasonName,
      seasonYear,
      registrationNumberPrefix,
      registrationNumberSeqDigits,
    ],
  );

  function patchDraft(patch: Partial<ResolvedBadgePrintSettings>) {
    setDraft((prev) => ({ ...prev, ...patch }));
  }

  function handleLogoChange(file: File | null) {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setLogoPreview(url);
  }

  function patchTypography(patch: Partial<BadgeTypographySettings>) {
    setTypography((prev) => ({ ...prev, ...patch }));
  }

  useEffect(() => {
    if (!state?.ok) return;
    setDraft(settings);
    setFormFields(settings.formFields);
    setTypography(settings.typography);
    setLogoPreview(settings.logoUrl);
  }, [state?.ok, settings]);

  return (
    <form action={action} encType="multipart/form-data" className="max-w-2xl space-y-8">
      <input type="hidden" name="customFieldsJson" value={JSON.stringify(formFields)} readOnly />
      <input type="hidden" name="typographyJson" value={JSON.stringify(typography)} readOnly />
      <input type="hidden" name="horizontalLayout" value={draft.horizontalLayout} readOnly />

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
        <h2 className="text-sm font-semibold text-foreground/90">Print preferences</h2>
        <p className="mt-1 text-sm text-muted">
          Control check-in desk printing on iPads. Save settings to apply at the check-in desk — no app
          update needed.
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
            description="Prints a badge immediately after staff tap Check in (iPad must be paired to the thermal printer)."
            checked={draft.autoPrintOnCheckIn}
            onChange={(autoPrintOnCheckIn) => patchDraft({ autoPrintOnCheckIn })}
          />
        </div>
      </div>

      <div className="rounded-xl border border-foreground/10 p-4">
        <h2 className="text-sm font-semibold text-foreground/90">Label stock & layout</h2>
        <p className="mt-1 text-sm text-muted">
          Match your physical label stock. For Brother QL-820 on DK-2205 (62 mm tape), choose{" "}
          <strong className="font-medium text-foreground/80">62 mm continuous roll</strong> and{" "}
          <strong className="font-medium text-foreground/80">Horizontal</strong>. Set the printer media
          to <strong className="font-medium text-foreground/80">62 mm continuous</strong> (not die-cut).
          The preview below matches what iPads print.
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
        ) : null}
      </div>

      <div className="rounded-xl border border-foreground/10 p-4">
        <h2 className="text-sm font-semibold text-foreground/90">Built-in fields</h2>
        <p className="mt-1 text-sm text-muted">
          Standard check-in data always available for every registration. Class names and check-in labels
          come from{" "}
          <Link href="/classes" className="font-medium text-brand underline">
            Classes
          </Link>
          . Add guardian phone, t-shirt size, and other answers under Registration form fields below.
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
            label="Registration code"
            description="Printed in the header box on horizontal layouts."
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
          Each field prints once as <strong className="font-medium text-foreground/80">Label: value</strong>{" "}
          using the child&apos;s submitted answers. Reorder with ↑↓ — that order is used on the label.
        </p>
        <div className="mt-4">
          <BadgeFormFieldsPicker
            fields={formFields}
            options={formFieldOptions}
            onChange={setFormFields}
            defaultFontPt={typography.detailPt}
          />
        </div>
      </div>

      {draft.orientation === "HORIZONTAL" &&
      (draft.horizontalLayout === "KIDCHECK" || draft.horizontalLayout === "NAME_CODE_HEADER") ? (
        <div className="rounded-xl border border-foreground/10 p-4">
          <h2 className="text-sm font-semibold text-foreground/90">Line order</h2>
          <p className="mt-1 text-sm text-muted">
            Reorder the blocks below the name on horizontal badges. The header (name, registration code,
            QR{draft.horizontalLayout === "KIDCHECK" ? ", logo strip, timestamp" : ""}) stays fixed — only
            these lines move.
          </p>
          <div className="mt-4">
            <BadgeDetailFieldOrderEditor
              order={typography.detailFieldOrder}
              onChange={(detailFieldOrder) => patchTypography({ detailFieldOrder })}
            />
          </div>
        </div>
      ) : null}

      {draft.orientation === "HORIZONTAL" ? (
        <div className="rounded-xl border border-foreground/10 p-4">
          <h2 className="text-sm font-semibold text-foreground/90">Typography & spacing</h2>
          <p className="mt-1 text-sm text-muted">
            Tune font sizes and spacing for iPad Brother printing. If detail lines hide behind the QR
            code, try a smaller <strong className="font-medium text-foreground/80">QR size</strong> or{" "}
            <strong className="font-medium text-foreground/80">Detail lines</strong> size, and increase{" "}
            <strong className="font-medium text-foreground/80">line spacing</strong>. Changes apply on
            the next badge print — no app update needed.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <TypographyNumberField
              label="Child name"
              value={typography.namePt}
              min={8}
              max={36}
              step={1}
              unit="pt"
              onChange={(namePt) => patchTypography({ namePt })}
            />
            <TypographyNumberField
              label="Class line"
              value={typography.classPt}
              min={8}
              max={32}
              step={1}
              unit="pt"
              onChange={(classPt) => patchTypography({ classPt })}
            />
            <TypographyNumberField
              label="Detail lines"
              description="Default size for registration form fields when no per-field size is set."
              value={typography.detailPt}
              min={6}
              max={24}
              step={1}
              unit="pt"
              onChange={(detailPt) => patchTypography({ detailPt })}
            />
            <TypographyNumberField
              label="Season line"
              value={typography.seasonPt}
              min={6}
              max={18}
              step={1}
              unit="pt"
              onChange={(seasonPt) => patchTypography({ seasonPt })}
            />
            <TypographyNumberField
              label="Registration code"
              value={typography.codePt}
              min={6}
              max={18}
              step={1}
              unit="pt"
              onChange={(codePt) => patchTypography({ codePt })}
            />
            <TypographyNumberField
              label="Timestamp"
              value={typography.timestampPt}
              min={6}
              max={16}
              step={1}
              unit="pt"
              onChange={(timestampPt) => patchTypography({ timestampPt })}
            />
            <TypographyNumberField
              label="Line spacing"
              description="Space between separate lines on the badge."
              value={typography.lineGapIn}
              min={0}
              max={0.12}
              step={0.004}
              unit="in"
              onChange={(lineGapIn) => patchTypography({ lineGapIn })}
            />
            <TypographyNumberField
              label="Wrapped line spacing"
              description="Space when a long line wraps to a second row."
              value={typography.wrapGapIn}
              min={0}
              max={0.08}
              step={0.002}
              unit="in"
              onChange={(wrapGapIn) => patchTypography({ wrapGapIn })}
            />
            <TypographyNumberField
              label="QR code size"
              description="Smaller QR leaves more room for text on the left."
              value={typography.qrSizeIn}
              min={0.45}
              max={1.2}
              step={0.05}
              unit="in"
              onChange={(qrSizeIn) => patchTypography({ qrSizeIn })}
            />
          </div>
          <div className="mt-4 space-y-2 border-t border-foreground/10 pt-4">
            <span className="block text-xs font-medium text-foreground/70">Detail line weight</span>
            <p className="text-[11px] text-muted">
              Control bold vs regular text on detail lines (e.g.{" "}
              <span className="font-semibold text-foreground/80">T-Shirt Size:</span>{" "}
              <span className="font-normal text-foreground/80">Adult-Small</span>).
            </p>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={typography.detailLabelBold}
                onChange={(e) => patchTypography({ detailLabelBold: e.target.checked })}
                className="rounded"
              />
              Bold field labels
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={typography.detailValueBold}
                onChange={(e) => patchTypography({ detailValueBold: e.target.checked })}
                className="rounded"
              />
              Bold field values
            </label>
          </div>
          <button
            type="button"
            onClick={() => setTypography({ ...DEFAULT_BADGE_TYPOGRAPHY })}
            className="mt-4 text-sm font-medium text-brand underline-offset-4 hover:underline"
          >
            Reset typography to defaults
          </button>
        </div>
      ) : null}

      <div className="rounded-xl border border-foreground/10 p-4">
        <h2 className="text-sm font-semibold text-foreground/90">Badge logo</h2>
        <p className="mt-1 text-sm text-muted">
          Upload a small image for each badge (JPEG, PNG, WebP, or GIF). On iPad Brother printing, KidCheck
          layout shows the logo in a vertical strip at the end of the label.
        </p>
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
        <p className="mt-1 text-sm text-muted">
          Horizontal badges print in the VBS check-in layout: child name, event, class, t-shirt size,
          guardian name and phone on the left; registration code, QR, and check-in time (Central) on the
          bottom right. Add a registration form field whose name includes &quot;shirt&quot; for t-shirt size.
        </p>
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
