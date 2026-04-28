"use client";

import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  formatVbsParticipantAgeAsOfLabel,
  VBS_PARTICIPANT_MAX_YEARS,
  VBS_PARTICIPANT_MIN_YEARS,
} from "@/lib/vbs-participant-age-gate";
import { updateRegistrationFormSettings } from "../../actions";
import type { WaiverSupplementalFieldDef } from "@/lib/waiver-merge-fields";

function newSupplementalWaiverField(): WaiverSupplementalFieldDef {
  const suffix =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 10)
      : `${Date.now()}`;
  return { key: `w_supp_${suffix}`, label: "", required: false };
}

function toDatetimeLocalValue(d: Date | null | undefined): string {
  if (!d) return "";
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 16);
}

function fromDatetimeLocalValue(s: string): Date | null {
  const t = s.trim();
  if (!t) return null;
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function FormSettingsForm({
  seasonId,
  initial,
  hidePublicRegistrationOpen = false,
  paymentConditionFieldOptions = [],
  waiverMergeFieldOptions,
  onSaveSuccess,
}: {
  seasonId: string;
  /** Called after settings persist (e.g. refetch embed workspace payload). */
  onSaveSuccess?: () => void;
  /** When true, `publicRegistrationOpen` is omitted from this form (managed elsewhere, e.g. embed workspace). */
  hidePublicRegistrationOpen?: boolean;
  initial: {
    title: string;
    welcomeMessage: string | null;
    instructions: string | null;
    confirmationMessage: string | null;
    registrationOpensAt: Date | null;
    registrationClosesAt: Date | null;
    maxTotalRegistrations: number | null;
    waitlistEnabled: boolean;
    publicRegistrationOpen: boolean;
    minimumParticipantAgeYears: number | null;
    maximumParticipantAgeYears: number | null;
    registrationNumberPrefix: string | null;
    registrationNumberSeqDigits: number;
    registrationNumberLastSeq: number;
    stripeCheckoutEnabled: boolean;
    stripeAmountCents: number | null;
    stripePricingUnit: "PER_SUBMISSION" | "PER_CHILD";
    stripeProcessingFeeMode: "OPTIONAL" | "REQUIRED";
    stripeProductLabel: string | null;
    stripeSkipWhenFieldKey: string | null;
    stripeSkipWhenFieldValue: string | null;
    waiverEnabled: boolean;
    waiverTitle: string | null;
    waiverDescription: string | null;
    waiverBody: string | null;
    waiverMergeFieldKeys?: string[] | null;
    waiverSupplementalFields?: WaiverSupplementalFieldDef[] | null;
    /** Form field keys shown in staff “Add unassigned student” class dropdown (same key set as waiver PDF merge). */
    unassignedClassPickerFieldKeys?: string[] | null;
    /** Optional per-season public help email shown on cards / register / thank-you. */
    helpContactEmail?: string | null;
    /** When set, parent can use as React `key` so defaults refresh after save (see form workspace embed). */
    settingsStamp?: string;
  };
  paymentConditionFieldOptions?: Array<{
    key: string;
    label: string;
    audience: "guardian" | "eachChild";
  }>;
  /** Guardian + consent + per-child fields offered for “include on waiver PDF”. Defaults to payment options + consent. */
  waiverMergeFieldOptions?: Array<{
    key: string;
    label: string;
    audience: "guardian" | "eachChild" | "consent";
  }>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const msgRef = useRef<HTMLParagraphElement>(null);
  const [waiverEnabled, setWaiverEnabled] = useState(initial.waiverEnabled);
  const [waiverTitle, setWaiverTitle] = useState(() => initial.waiverTitle?.trim() || "Medical Liability Release Form");
  const [waiverDescription, setWaiverDescription] = useState(initial.waiverDescription ?? "");
  const [waiverBody, setWaiverBody] = useState(initial.waiverBody ?? "");
  const [waiverMergeFieldKeys, setWaiverMergeFieldKeys] = useState<string[]>(() => [
    ...(initial.waiverMergeFieldKeys ?? []),
  ]);
  const [waiverSupplementalRows, setWaiverSupplementalRows] = useState<WaiverSupplementalFieldDef[]>(() => [
    ...(initial.waiverSupplementalFields ?? []),
  ]);
  const [unassignedClassPickerFieldKeys, setUnassignedClassPickerFieldKeys] = useState<string[]>(() => [
    ...(initial.unassignedClassPickerFieldKeys ?? []),
  ]);

  const settingsStamp = initial.settingsStamp ?? "";
  // Only reset waiver UI when the server sends a new snapshot (stamp), not on every `initial` reference change.
  useEffect(() => {
    setWaiverEnabled(initial.waiverEnabled);
    setWaiverTitle(initial.waiverTitle?.trim() || "Medical Liability Release Form");
    setWaiverDescription(initial.waiverDescription ?? "");
    setWaiverBody(initial.waiverBody ?? "");
    setWaiverMergeFieldKeys([...(initial.waiverMergeFieldKeys ?? [])]);
    setWaiverSupplementalRows([...(initial.waiverSupplementalFields ?? [])]);
    setUnassignedClassPickerFieldKeys([...(initial.unassignedClassPickerFieldKeys ?? [])]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stamp is the explicit snapshot boundary
  }, [settingsStamp]);

  const mergeFieldOptions =
    waiverMergeFieldOptions ??
    (paymentConditionFieldOptions as Array<{
      key: string;
      label: string;
      audience: "guardian" | "eachChild" | "consent";
    }>);

  return (
    <form
      className="space-y-8"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const title = String(fd.get("title") ?? "").trim();
        const welcomeMessage = String(fd.get("welcomeMessage") ?? "").trim() || null;
        const instructions = String(fd.get("instructions") ?? "").trim() || null;
        const confirmationMessage = String(fd.get("confirmationMessage") ?? "").trim() || null;
        const opens = fromDatetimeLocalValue(String(fd.get("registrationOpensAt") ?? ""));
        const closes = fromDatetimeLocalValue(String(fd.get("registrationClosesAt") ?? ""));
        const maxRaw = String(fd.get("maxTotalRegistrations") ?? "").trim();
        const maxTotalRegistrations = maxRaw ? Math.max(0, parseInt(maxRaw, 10) || 0) : null;
        const waitlistEnabled = fd.get("waitlistEnabled") === "on";
        const publicRegistrationOpen = hidePublicRegistrationOpen
          ? initial.publicRegistrationOpen
          : fd.get("publicRegistrationOpen") === "on";
        const minAgeRaw = String(fd.get("minimumParticipantAgeYears") ?? "").trim();
        const minParsed = parseInt(minAgeRaw, 10);
        const minimumParticipantAgeYears =
          minAgeRaw && Number.isFinite(minParsed) && minParsed >= 1
            ? Math.min(99, minParsed)
            : null;
        const maxAgeRaw = String(fd.get("maximumParticipantAgeYears") ?? "").trim();
        const maxParsed = parseInt(maxAgeRaw, 10);
        const maximumParticipantAgeYears =
          maxAgeRaw && Number.isFinite(maxParsed) && maxParsed >= 1
            ? Math.min(99, maxParsed)
            : null;

        const regPrefixRaw = String(fd.get("registrationNumberPrefix") ?? "").trim();
        const registrationNumberPrefix = regPrefixRaw.length > 0 ? regPrefixRaw : null;
        const seqDigRaw = String(fd.get("registrationNumberSeqDigits") ?? "").trim();
        const seqDigParsed = parseInt(seqDigRaw, 10);
        const registrationNumberSeqDigits =
          seqDigRaw && Number.isFinite(seqDigParsed) ? seqDigParsed : initial.registrationNumberSeqDigits;

        const stripeCheckoutEnabled = fd.get("stripeCheckoutEnabled") === "on";
        const stripeDollarsRaw = String(fd.get("stripeAmountDollars") ?? "").trim();
        const stripeAmountParsed = stripeDollarsRaw ? Number.parseFloat(stripeDollarsRaw) : NaN;
        const stripeAmountCents =
          stripeCheckoutEnabled && Number.isFinite(stripeAmountParsed) && stripeAmountParsed > 0
            ? Math.round(stripeAmountParsed * 100)
            : null;
        const stripePricingUnit =
          String(fd.get("stripePricingUnit") ?? "") === "PER_CHILD" ? "PER_CHILD" : "PER_SUBMISSION";
        const stripeProcessingFeeMode =
          String(fd.get("stripeProcessingFeeMode") ?? "") === "REQUIRED" ? "REQUIRED" : "OPTIONAL";
        const stripeProductLabel = String(fd.get("stripeProductLabel") ?? "").trim() || null;
        const helpContactEmail = String(fd.get("helpContactEmail") ?? "").trim() || null;
        let stripeSkipWhenFieldKey = String(fd.get("stripeSkipWhenFieldKey") ?? "").trim() || null;
        let stripeSkipWhenFieldValue = String(fd.get("stripeSkipWhenFieldValue") ?? "").trim() || null;
        if (!stripeSkipWhenFieldKey) {
          stripeSkipWhenFieldValue = null;
        }

        const bumpMsg = (t: string) => {
          setMsg(t);
          queueMicrotask(() => msgRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }));
        };

        if (stripeCheckoutEnabled && (stripeAmountCents == null || stripeAmountCents < 50)) {
          bumpMsg(
            "Stripe payment is on but the fee is missing or below US$0.50. Enter a valid amount in “Fee (USD)”, or turn off “Require Stripe payment for this form”. Nothing is saved until this is fixed — including waiver settings.",
          );
          return;
        }
        if (stripeSkipWhenFieldKey && !stripeSkipWhenFieldValue) {
          bumpMsg(
            "To use conditional payment skip, choose a matching value for the selected field, or set the field back to “No conditional skip”.",
          );
          return;
        }

        if (
          minimumParticipantAgeYears != null &&
          maximumParticipantAgeYears != null &&
          minimumParticipantAgeYears > maximumParticipantAgeYears
        ) {
          bumpMsg("Minimum age cannot be greater than maximum age.");
          return;
        }

        setMsg(null);
        startTransition(async () => {
          const r = await updateRegistrationFormSettings(seasonId, {
            title,
            welcomeMessage,
            instructions,
            confirmationMessage,
            registrationOpensAt: opens,
            registrationClosesAt: closes,
            maxTotalRegistrations,
            waitlistEnabled,
            publicRegistrationOpen,
            minimumParticipantAgeYears,
            maximumParticipantAgeYears,
            registrationNumberPrefix,
            registrationNumberSeqDigits,
            stripeCheckoutEnabled,
            stripeAmountCents,
            stripePricingUnit,
            stripeProcessingFeeMode,
            stripeProductLabel,
            stripeSkipWhenFieldKey,
            stripeSkipWhenFieldValue,
            helpContactEmail,
            waiverEnabled,
            waiverTitle: waiverTitle.trim() || null,
            waiverDescription: waiverDescription.trim() || null,
            waiverBody: waiverBody.trim() || null,
            waiverMergeFieldKeys: waiverEnabled ? waiverMergeFieldKeys : [],
            waiverSupplementalFields: waiverEnabled ? waiverSupplementalRows : [],
            unassignedClassPickerFieldKeys,
          });
          setMsg(r.message);
          if (r.ok) {
            onSaveSuccess?.();
            router.refresh();
          } else {
            queueMicrotask(() => msgRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }));
          }
        });
      }}
    >
      <div className="space-y-4 rounded-xl border border-foreground/10 p-4">
        <h2 className="text-sm font-semibold">Form copy & messages</h2>
        <div>
          <label htmlFor="title" className="block text-xs font-medium text-foreground/70">
            Form title (public header)
          </label>
          <input
            id="title"
            name="title"
            required
            defaultValue={initial.title}
            className="mt-1 w-full rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="welcomeMessage" className="block text-xs font-medium text-foreground/70">
            Welcome text (shown under the title; can override season default)
          </label>
          <textarea
            id="welcomeMessage"
            name="welcomeMessage"
            rows={3}
            defaultValue={initial.welcomeMessage ?? ""}
            className="mt-1 w-full rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="instructions" className="block text-xs font-medium text-foreground/70">
            Instructions (optional, longer guidance)
          </label>
          <textarea
            id="instructions"
            name="instructions"
            rows={4}
            defaultValue={initial.instructions ?? ""}
            className="mt-1 w-full rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="confirmationMessage" className="block text-xs font-medium text-foreground/70">
            Confirmation message (after successful submit)
          </label>
          <textarea
            id="confirmationMessage"
            name="confirmationMessage"
            rows={3}
            defaultValue={initial.confirmationMessage ?? ""}
            className="mt-1 w-full rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="helpContactEmail" className="block text-xs font-medium text-foreground/70">
            Help email (shown on landing / register / thank-you)
          </label>
          <input
            id="helpContactEmail"
            name="helpContactEmail"
            type="email"
            defaultValue={initial.helpContactEmail ?? ""}
            placeholder="e.g. vbs@ipchouston.com"
            className="mt-1 w-full rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="space-y-4 rounded-xl border border-foreground/10 p-4">
        <h2 className="text-sm font-semibold">Registration number template</h2>
        <p className="text-sm text-foreground/70">
          When staff <strong>approves</strong> a child (or adds a confirmed office registration), the system assigns
          a ticket / badge number. Leave the prefix empty to keep the default{" "}
          <code className="rounded bg-foreground/[0.06] px-1 py-0.5 text-xs">VBS-{"{year}"}-{"{random}"}</code>{" "}
          style. With a prefix, numbers are sequential: e.g. prefix <code className="text-xs">IPCHVBS-</code> and three
          digits → <code className="text-xs">IPCHVBS-001</code>, <code className="text-xs">IPCHVBS-002</code>, …
        </p>
        <div>
          <label htmlFor="registrationNumberPrefix" className="block text-xs font-medium text-foreground/70">
            Number prefix (optional)
          </label>
          <input
            id="registrationNumberPrefix"
            name="registrationNumberPrefix"
            type="text"
            maxLength={32}
            placeholder="e.g. IPCHVBS-"
            defaultValue={initial.registrationNumberPrefix ?? ""}
            className="mt-1 w-full max-w-md rounded-md border border-foreground/15 bg-background px-3 py-2 font-mono text-sm"
          />
          <p className="mt-1 text-xs text-foreground/60">
            Letters, digits, <code className="text-[11px]">-</code> and <code className="text-[11px]">_</code>; must
            start with a letter or digit. Include a trailing hyphen if you want one.
          </p>
        </div>
        <div>
          <label htmlFor="registrationNumberSeqDigits" className="block text-xs font-medium text-foreground/70">
            Sequence digit width
          </label>
          <input
            id="registrationNumberSeqDigits"
            name="registrationNumberSeqDigits"
            type="number"
            min={2}
            max={8}
            defaultValue={initial.registrationNumberSeqDigits}
            className="mt-1 w-full max-w-[8rem] rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm tabular-nums"
          />
          <p className="mt-1 text-xs text-foreground/60">Between 2 and 8 (default 3 → 001, 002, …).</p>
        </div>
        <p className="text-xs text-foreground/60">
          Last issued sequence index:{" "}
          <span className="font-mono tabular-nums text-foreground/80">{initial.registrationNumberLastSeq}</span>
          {initial.registrationNumberPrefix?.trim() ? (
            <>
              {" — "}
              next sequential example:{" "}
              <span className="font-mono tabular-nums text-foreground/80">
                {initial.registrationNumberPrefix.trim() +
                  String(initial.registrationNumberLastSeq + 1).padStart(
                    Math.min(8, Math.max(2, initial.registrationNumberSeqDigits)),
                    "0",
                  )}
              </span>
            </>
          ) : (
            <> — save a prefix to use sequential numbers instead of the default format.</>
          )}
        </p>
      </div>

      <div className="space-y-4 rounded-xl border border-foreground/10 p-4">
        <h2 className="text-sm font-semibold">Class roster — unassigned picker</h2>
        <p className="text-sm text-foreground/70">
          When staff use <strong>Add unassigned students</strong> on a class page, the dropdown can show extra
          answers from the registration form (for example grade or shirt size). Pick any combination of fields below;
          leave none selected to show only name, status, and registration number.{" "}
          <span className="font-medium text-foreground/85">Age (~years)</span> is always appended when the class uses
          an age rule, so you do not need to select date of birth unless you want the exact date shown.
        </p>
        {mergeFieldOptions.length > 0 ? (
          <div>
            <p className="text-xs font-medium text-foreground/70">Show in “Add unassigned” dropdown</p>
            <ul className="mt-2 max-h-48 space-y-1.5 overflow-y-auto rounded-md border border-foreground/10 p-2 text-sm">
              {mergeFieldOptions.map((opt) => (
                <li key={`picker-${opt.key}`}>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      className="size-4 rounded border-foreground/30"
                      checked={unassignedClassPickerFieldKeys.includes(opt.key)}
                      onChange={() =>
                        setUnassignedClassPickerFieldKeys((prev) =>
                          prev.includes(opt.key) ? prev.filter((k) => k !== opt.key) : [...prev, opt.key],
                        )
                      }
                    />
                    <span>
                      <span className="font-medium">{opt.label}</span>
                      <span className="text-foreground/50">
                        {" "}
                        (
                        {opt.audience === "guardian"
                          ? "Guardian"
                          : opt.audience === "consent"
                            ? "Consent"
                            : "Child"}
                        )
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-xs text-foreground/60">Publish a form definition with fields to enable this list.</p>
        )}
      </div>

      <div className="space-y-4 rounded-xl border border-foreground/10 p-4">
        <h2 className="text-sm font-semibold">Stripe online payment</h2>
        <p className="text-sm text-foreground/70">
          After families submit the form, they are sent to Stripe Checkout to pay by card. Requires{" "}
          <code className="rounded bg-foreground/[0.06] px-1 text-xs">STRIPE_SECRET_KEY</code> and a webhook endpoint
          (see project env docs). Confirmation email is sent after payment succeeds.
        </p>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            name="stripeCheckoutEnabled"
            defaultChecked={initial.stripeCheckoutEnabled}
            className="size-4 rounded border-foreground/30"
          />
          Require Stripe payment for this form
        </label>
        <p className="text-xs text-foreground/60">
          The <strong>Fee (USD)</strong> amount and <strong>Fee applies to</strong> work together: choose{" "}
          <strong>Per child</strong> if the dollar amount is for each student (e.g. US$25 with three children → US$75
          base, plus processing gross-up when enabled). Choose <strong>One payment per form</strong> if families pay
          that amount once no matter how many children are on the same submission. The public review page and Stripe
          Checkout use the same total.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="stripeAmountDollars" className="block text-xs font-medium text-foreground/70">
              Fee (USD)
            </label>
            <input
              id="stripeAmountDollars"
              name="stripeAmountDollars"
              type="number"
              min={0}
              step={0.01}
              placeholder="e.g. 25.00"
              defaultValue={
                initial.stripeAmountCents != null && initial.stripeAmountCents > 0
                  ? (initial.stripeAmountCents / 100).toFixed(2)
                  : ""
              }
              className="mt-1 w-full rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-foreground/60">Minimum US$0.50 when Stripe is on.</p>
          </div>
          <div>
            <label htmlFor="stripePricingUnit" className="block text-xs font-medium text-foreground/70">
              Fee applies to
            </label>
            <select
              id="stripePricingUnit"
              name="stripePricingUnit"
              defaultValue={initial.stripePricingUnit}
              className="mt-1 w-full rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm"
            >
              <option value="PER_SUBMISSION">One payment per form (all children)</option>
              <option value="PER_CHILD">Per child (total = fee × number of children)</option>
            </select>
            <p className="mt-1 text-xs text-foreground/60">
              Current form setting:{" "}
              <span className="font-medium text-foreground/80">
                {initial.stripePricingUnit === "PER_CHILD" ? "Per child (fee × children)" : "One payment per form"}
              </span>
              . Save after changing.
            </p>
          </div>
        </div>
        <div>
          <span className="block text-xs font-medium text-foreground/70">Card processing fee</span>
          <p className="mt-1 text-xs text-foreground/60">
            We estimate Stripe&apos;s US card rate (2.9% + 30¢) and can add a gross-up so the church receives the full
            base amount when families choose to cover fees — or you can require that gross-up for everyone.
          </p>
          <div className="mt-2 space-y-2 text-sm">
            <label className="flex items-start gap-2">
              <input
                type="radio"
                name="stripeProcessingFeeMode"
                value="OPTIONAL"
                defaultChecked={initial.stripeProcessingFeeMode === "OPTIONAL"}
                className="mt-1"
              />
              <span>
                <strong>Optional</strong> — show a checkbox so families can choose to cover processing fees (recommended
                default).
              </span>
            </label>
            <label className="flex items-start gap-2">
              <input
                type="radio"
                name="stripeProcessingFeeMode"
                value="REQUIRED"
                defaultChecked={initial.stripeProcessingFeeMode === "REQUIRED"}
                className="mt-1"
              />
              <span>
                <strong>Required</strong> — every payment includes the processing gross-up (no opt-out).
              </span>
            </label>
          </div>
        </div>
        <div>
          <label htmlFor="stripeSkipWhenFieldKey" className="block text-xs font-medium text-foreground/70">
            Optional no-payment rule (field)
          </label>
          <select
            id="stripeSkipWhenFieldKey"
            name="stripeSkipWhenFieldKey"
            defaultValue={initial.stripeSkipWhenFieldKey ?? ""}
            className="mt-1 w-full rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm"
          >
            <option value="">No conditional skip</option>
            {paymentConditionFieldOptions.map((f) => (
              <option key={f.key} value={f.key}>
                {f.audience === "guardian" ? "Guardian" : "Child"}: {f.label} ({f.key})
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-foreground/60">
            If the selected field equals the value below, Stripe checkout will be skipped for that submission.
          </p>
        </div>
        <div>
          <label htmlFor="stripeSkipWhenFieldValue" className="block text-xs font-medium text-foreground/70">
            Optional no-payment rule (match value)
          </label>
          <input
            id="stripeSkipWhenFieldValue"
            name="stripeSkipWhenFieldValue"
            type="text"
            maxLength={120}
            placeholder="e.g. scholarship or yes"
            defaultValue={initial.stripeSkipWhenFieldValue ?? ""}
            className="mt-1 w-full rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="stripeProductLabel" className="block text-xs font-medium text-foreground/70">
            Checkout product title (optional)
          </label>
          <input
            id="stripeProductLabel"
            name="stripeProductLabel"
            type="text"
            maxLength={120}
            placeholder="e.g. Summer VBS 2026 registration"
            defaultValue={initial.stripeProductLabel ?? ""}
            className="mt-1 w-full rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="space-y-4 rounded-xl border border-foreground/10 p-4">
        <h2 className="text-sm font-semibold">Waiver form</h2>
        <p className="text-sm text-foreground/70">
          Enable a dedicated digital waiver step in public registration. Parents sign once per child; a PDF is stored
          for each child. Choose which registration answers appear on the PDF, and optionally add extra short-answer
          prompts.
        </p>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={waiverEnabled}
            onChange={(e) => setWaiverEnabled(e.target.checked)}
            className="size-4 rounded border-foreground/30"
          />
          Require digital waiver signature
        </label>
        <div>
          <label htmlFor="waiverTitle" className="block text-xs font-medium text-foreground/70">
            Waiver title
          </label>
          <input
            id="waiverTitle"
            value={waiverTitle}
            onChange={(e) => setWaiverTitle(e.target.value)}
            className="mt-1 w-full rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="waiverDescription" className="block text-xs font-medium text-foreground/70">
            Waiver description (optional)
          </label>
          <textarea
            id="waiverDescription"
            rows={3}
            value={waiverDescription}
            onChange={(e) => setWaiverDescription(e.target.value)}
            className="mt-1 w-full rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm"
            placeholder="Short note shown under the title on the public waiver step and on the signed PDF."
          />
        </div>
        <div>
          <label htmlFor="waiverBody" className="block text-xs font-medium text-foreground/70">
            Waiver statement text
          </label>
          <textarea
            id="waiverBody"
            rows={7}
            value={waiverBody}
            onChange={(e) => setWaiverBody(e.target.value)}
            className="mt-1 w-full rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm"
            placeholder="Enter waiver language that guardians must accept and sign."
          />
        </div>
        {mergeFieldOptions.length > 0 ? (
          <div>
            <p className="text-xs font-medium text-foreground/70">Include on signed waiver PDF (from this form)</p>
            <p className="mt-1 text-xs text-foreground/55">
              Guardian and per-child fields below are copied from what the family already entered. Child name and date
              of birth are always shown on each child&apos;s PDF.
            </p>
            <ul className="mt-2 max-h-48 space-y-1.5 overflow-y-auto rounded-md border border-foreground/10 p-2 text-sm">
              {mergeFieldOptions.map((opt) => (
                <li key={opt.key}>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      className="size-4 rounded border-foreground/30"
                      checked={waiverMergeFieldKeys.includes(opt.key)}
                      onChange={() =>
                        setWaiverMergeFieldKeys((prev) =>
                          prev.includes(opt.key) ? prev.filter((k) => k !== opt.key) : [...prev, opt.key],
                        )
                      }
                    />
                    <span>
                      <span className="font-medium">{opt.label}</span>
                      <span className="text-foreground/50">
                        {" "}
                        (
                        {opt.audience === "guardian"
                          ? "Guardian"
                          : opt.audience === "consent"
                            ? "Consent"
                            : "Child"}
                        )
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-foreground/70">Optional extra waiver questions (per child)</p>
            <button
              type="button"
              onClick={() => setWaiverSupplementalRows((r) => [...r, newSupplementalWaiverField()])}
              className="inline-flex items-center gap-1 rounded-md border border-foreground/15 bg-foreground/[0.04] px-2 py-1 text-xs font-medium text-foreground/80 hover:bg-foreground/[0.08]"
            >
              <Plus className="size-3.5" aria-hidden />
              Add field
            </button>
          </div>
          <p className="mt-1 text-xs text-foreground/55">
            Shown only on the waiver step. Answers are saved on each child&apos;s PDF (e.g. emergency contact).
          </p>
          <ul className="mt-2 space-y-2">
            {waiverSupplementalRows.map((row, idx) => (
              <li
                key={row.key}
                className="flex flex-wrap items-end gap-2 rounded-md border border-foreground/10 bg-foreground/[0.02] p-2"
              >
                <div className="min-w-[160px] flex-1">
                  <label className="text-[11px] font-medium text-foreground/60">Label</label>
                  <input
                    value={row.label}
                    onChange={(e) =>
                      setWaiverSupplementalRows((rows) =>
                        rows.map((x, i) => (i === idx ? { ...x, label: e.target.value } : x)),
                      )
                    }
                    className="mt-0.5 w-full rounded-md border border-foreground/15 bg-background px-2 py-1.5 text-sm"
                    placeholder="e.g. Emergency contact phone"
                  />
                </div>
                <label className="flex items-center gap-1.5 pb-1.5 text-xs">
                  <input
                    type="checkbox"
                    checked={row.required}
                    onChange={(e) =>
                      setWaiverSupplementalRows((rows) =>
                        rows.map((x, i) => (i === idx ? { ...x, required: e.target.checked } : x)),
                      )
                    }
                    className="size-4 rounded border-foreground/30"
                  />
                  Required
                </label>
                <button
                  type="button"
                  onClick={() => setWaiverSupplementalRows((rows) => rows.filter((_, i) => i !== idx))}
                  className="inline-flex items-center gap-1 rounded-md p-1.5 text-red-600 hover:bg-red-500/10"
                  aria-label="Remove field"
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="space-y-4 rounded-xl border border-foreground/10 p-4">
        <h2 className="text-sm font-semibold">Registration window & capacity</h2>
        <p className="text-sm text-foreground/70">
          Date/time uses your browser&apos;s local timezone. Leave open/close empty for no extra date limits
          (season &quot;Public signup&quot; toggle still applies).
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="registrationOpensAt" className="block text-xs font-medium text-foreground/70">
              Registration opens
            </label>
            <input
              id="registrationOpensAt"
              name="registrationOpensAt"
              type="datetime-local"
              defaultValue={toDatetimeLocalValue(initial.registrationOpensAt)}
              className="mt-1 w-full rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="registrationClosesAt" className="block text-xs font-medium text-foreground/70">
              Registration closes
            </label>
            <input
              id="registrationClosesAt"
              name="registrationClosesAt"
              type="datetime-local"
              defaultValue={toDatetimeLocalValue(initial.registrationClosesAt)}
              className="mt-1 w-full rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div>
          <label htmlFor="maxTotalRegistrations" className="block text-xs font-medium text-foreground/70">
            Max registrations (total children, all submissions)
          </label>
          <input
            id="maxTotalRegistrations"
            name="maxTotalRegistrations"
            type="number"
            min={0}
            placeholder="No limit"
            defaultValue={initial.maxTotalRegistrations ?? ""}
            className="mt-1 w-full max-w-xs rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="minimumParticipantAgeYears"
              className="block text-xs font-medium text-foreground/70"
            >
              Minimum child age (optional)
            </label>
            <input
              id="minimumParticipantAgeYears"
              name="minimumParticipantAgeYears"
              type="number"
              min={1}
              max={99}
              placeholder="No minimum"
              defaultValue={initial.minimumParticipantAgeYears ?? ""}
              className="mt-1 w-full rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label
              htmlFor="maximumParticipantAgeYears"
              className="block text-xs font-medium text-foreground/70"
            >
              Maximum child age (optional)
            </label>
            <input
              id="maximumParticipantAgeYears"
              name="maximumParticipantAgeYears"
              type="number"
              min={1}
              max={99}
              placeholder="No maximum"
              defaultValue={initial.maximumParticipantAgeYears ?? ""}
              className="mt-1 w-full rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>
        <p className="text-xs text-foreground/60">
          Public registration enforces ages {VBS_PARTICIPANT_MIN_YEARS}–{VBS_PARTICIPANT_MAX_YEARS} as of{" "}
          {formatVbsParticipantAgeAsOfLabel()} (whole years). The numbers above are saved with the form for reference;
          leave either empty if you do not use them elsewhere.
        </p>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="waitlistEnabled"
            defaultChecked={initial.waitlistEnabled}
            className="size-4 rounded border-foreground/30"
          />
          Waitlist when full (otherwise block submit)
        </label>
        {hidePublicRegistrationOpen ? null : (
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              name="publicRegistrationOpen"
              defaultChecked={initial.publicRegistrationOpen}
              className="size-4 rounded border-foreground/30"
            />
            Public signup open for this season (master switch; same as season public settings)
          </label>
        )}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save settings"}
      </button>
      {msg ? (
        <p
          ref={msgRef}
          className={
            msg.startsWith("Stripe payment is on") ||
            msg.startsWith("To use conditional payment skip") ||
            msg.includes("Nothing is saved until")
              ? "rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100"
              : "text-sm text-foreground/80"
          }
        >
          {msg}
        </p>
      ) : null}
    </form>
  );
}
