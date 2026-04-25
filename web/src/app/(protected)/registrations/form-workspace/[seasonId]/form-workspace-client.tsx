"use client";

import type { FormWorkspacePayload } from "../../forms/actions";
import { Check, Copy, ExternalLink, Sparkles } from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AdminFormPreview } from "../../forms/[seasonId]/preview/form-preview";
import { FormDefinitionEditor } from "../../forms/[seasonId]/edit/form-definition-editor";
import { FormSettingsForm } from "../../forms/[seasonId]/settings/form-settings-form";
import { PublicSignupQr } from "@/components/public-signup-qr";
import { WorkspacePublicDisplayForm } from "./workspace-public-display-form";

export type FormWorkspaceTab = "fields" | "preview" | "design" | "settings";

export type SettingsInitialSerialized = FormWorkspacePayload["settingsInitial"];

function parseSettingsInitial(s: SettingsInitialSerialized) {
  return {
    ...s,
    registrationOpensAt: s.registrationOpensAt ? new Date(s.registrationOpensAt) : null,
    registrationClosesAt: s.registrationClosesAt ? new Date(s.registrationClosesAt) : null,
  };
}

const TABS: { id: FormWorkspaceTab; label: string }[] = [
  { id: "fields", label: "Fields" },
  { id: "preview", label: "Preview" },
  { id: "design", label: "Design" },
  { id: "settings", label: "Settings" },
];

export type FormWorkspacePanelProps = FormWorkspacePayload & {
  variant: "page" | "embed";
  activeTab: FormWorkspaceTab;
  onTabChange: (t: FormWorkspaceTab) => void;
  /** Full-page workspace: Preview in editor uses this URL. */
  editorPreviewHref?: string;
  editorPreviewSameTab?: boolean;
  /** Inline embed: Preview in editor switches to the Preview tab. */
  onEditorPreviewNavigate?: () => void;
};

export function FormWorkspacePanel({
  variant,
  activeTab: tab,
  onTabChange: setTab,
  editorPreviewHref,
  editorPreviewSameTab,
  onEditorPreviewNavigate,
  seasonId,
  seasonName,
  year,
  formTitle,
  formStatus,
  publishedVersion,
  initialDefinition,
  previewDraftDefinition,
  previewPublishedDefinition,
  hasPublishedDefinition,
  settingsInitial,
  publicSignupUrl,
  publicDisplayInitial,
}: FormWorkspacePanelProps) {
  const [previewUseDraft, setPreviewUseDraft] = useState(true);
  const [copied, setCopied] = useState(false);

  const settingsParsed = useMemo(() => parseSettingsInitial(settingsInitial), [settingsInitial]);

  const copyPublic = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(publicSignupUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this link:", publicSignupUrl);
    }
  }, [publicSignupUrl]);

  const fullWorkspaceHref = `/registrations/form-workspace/${seasonId}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-foreground/10 pb-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-2">
            {variant === "page" ? (
              <>
                <Link href="/registrations/forms" className="text-sm font-medium text-brand hover:underline">
                  ← Form builder
                </Link>
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                    {seasonName} <span className="text-foreground/50">({year})</span>
                  </h1>
                  <p className="mt-1 text-sm text-foreground/70">{formTitle}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex rounded-full border border-foreground/15 bg-foreground/[0.06] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-foreground/85">
                    {formStatus}
                  </span>
                  {publishedVersion != null ? (
                    <span className="text-xs text-foreground/55">Published v{publishedVersion}</span>
                  ) : null}
                </div>
              </>
            ) : (
              <p className="text-xs text-foreground/55">Editing inline — expand/collapse this row on the list above.</p>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {variant === "embed" ? (
              <a
                href={fullWorkspaceHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-foreground/15 px-3 py-2 text-sm font-medium hover:bg-foreground/[0.04]"
              >
                <ExternalLink className="size-4" aria-hidden />
                Open full page
              </a>
            ) : null}
            <button
              type="button"
              onClick={copyPublic}
              className="inline-flex items-center gap-2 rounded-lg border border-foreground/15 px-3 py-2 text-sm font-medium hover:bg-foreground/[0.04]"
            >
              {copied ? <Check className="size-4 text-emerald-600" aria-hidden /> : <Copy className="size-4" aria-hidden />}
              Copy public link
            </button>
            <a
              href={publicSignupUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-foreground/15 px-3 py-2 text-sm font-medium hover:bg-foreground/[0.04]"
            >
              Open public signup
            </a>
            <Link
              href={`/registrations/forms/${seasonId}`}
              className="text-sm font-medium text-foreground/60 underline hover:text-foreground"
            >
              Season overview
            </Link>
          </div>
        </div>

        <div className="rounded-xl border border-foreground/10 bg-foreground/[0.02] p-4 sm:p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-foreground/50">Public signup QR</p>
          <p className="mt-1 text-sm text-foreground/65">Encodes the same link as &quot;Open public signup&quot; — for slides, lobby TVs, or handouts.</p>
          <div className="mt-4">
            <PublicSignupQr key={publicSignupUrl} url={publicSignupUrl} displaySize={variant === "embed" ? 168 : 220} />
          </div>
        </div>

        <nav className="flex flex-wrap gap-1 rounded-xl bg-foreground/[0.04] p-1 ring-1 ring-foreground/10" aria-label="Form workspace">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={
                  active
                    ? "rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground shadow-sm ring-1 ring-brand/30"
                    : "rounded-lg px-4 py-2 text-sm font-medium text-foreground/70 transition hover:bg-background/90 hover:text-foreground"
                }
              >
                {t.label}
              </button>
            );
          })}
        </nav>
      </div>

      <div className={variant === "embed" ? "max-h-[min(85vh,1200px)] overflow-y-auto pr-1" : "min-h-[50vh]"}>
        {tab === "fields" ? (
          <FormDefinitionEditor
            seasonId={seasonId}
            initialDefinition={initialDefinition}
            previewHref={onEditorPreviewNavigate ? undefined : editorPreviewHref}
            previewSameTab={!!editorPreviewSameTab}
            onPreviewNavigate={onEditorPreviewNavigate}
          />
        ) : null}

        {tab === "preview" ? (
          <div className="space-y-4">
            {hasPublishedDefinition ? (
              <div className="flex flex-wrap gap-2 text-sm">
                <button
                  type="button"
                  onClick={() => setPreviewUseDraft(true)}
                  className={
                    previewUseDraft
                      ? "rounded-md bg-foreground px-3 py-1.5 font-medium text-background"
                      : "rounded-md border border-foreground/15 px-3 py-1.5 font-medium text-foreground/80 hover:bg-foreground/[0.04]"
                  }
                >
                  Draft
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewUseDraft(false)}
                  className={
                    !previewUseDraft
                      ? "rounded-md bg-foreground px-3 py-1.5 font-medium text-background"
                      : "rounded-md border border-foreground/15 px-3 py-1.5 font-medium text-foreground/80 hover:bg-foreground/[0.04]"
                  }
                >
                  Published
                </button>
              </div>
            ) : (
              <p className="text-sm text-foreground/65">No published definition yet — showing draft only.</p>
            )}
            <AdminFormPreview
              definition={previewUseDraft || !hasPublishedDefinition ? previewDraftDefinition : previewPublishedDefinition}
              formTitle={formTitle}
              seasonName={seasonName}
            />
          </div>
        ) : null}

        {tab === "design" ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-foreground/20 bg-foreground/[0.02] px-6 py-16 text-center">
            <Sparkles className="size-10 text-brand/80" aria-hidden />
            <p className="text-base font-semibold text-foreground">Design</p>
            <p className="max-w-md text-sm text-foreground/65">
              Theming, header image, and layout options can live here later.
            </p>
          </div>
        ) : null}

        {tab === "settings" ? (
          <div className="mx-auto max-w-3xl space-y-6">
            {variant === "embed" ? (
              <>
                <WorkspacePublicDisplayForm
                  seasonId={seasonId}
                  publicRegistrationOpen={settingsInitial.publicRegistrationOpen}
                  registrationBackgroundImageUrl={publicDisplayInitial.registrationBackgroundImageUrl}
                  registrationBackgroundVideoUrl={publicDisplayInitial.registrationBackgroundVideoUrl}
                  registrationBackgroundDimmingPercent={publicDisplayInitial.registrationBackgroundDimmingPercent}
                  registrationBackgroundLayout={publicDisplayInitial.registrationBackgroundLayout}
                  requireGuardianEmail={publicDisplayInitial.requireGuardianEmail}
                  requireGuardianPhone={publicDisplayInitial.requireGuardianPhone}
                  requireAllergiesNotes={publicDisplayInitial.requireAllergiesNotes}
                  welcomeMessage={publicDisplayInitial.welcomeMessage}
                />
                <p className="text-sm text-foreground/70">
                  The same public fields can be edited from{" "}
                  <a href={`/seasons/${seasonId}/public-settings`} className="font-medium text-brand underline">
                    Public registration
                  </a>{" "}
                  (gate and background only).
                </p>
              </>
            ) : (
              <p className="text-sm text-foreground/70">
                Background image and field-level display rules live on{" "}
                <a href={`/seasons/${seasonId}/public-settings`} className="font-medium text-brand underline">
                  Public registration settings
                </a>
                .
              </p>
            )}
            <FormSettingsForm
              seasonId={seasonId}
              initial={settingsParsed}
              hidePublicRegistrationOpen={variant === "embed"}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

export type FormWorkspacePageClientProps = Omit<
  FormWorkspacePanelProps,
  "variant" | "activeTab" | "onTabChange" | "editorPreviewHref" | "editorPreviewSameTab" | "onEditorPreviewNavigate"
>;

export function FormWorkspacePageClient(props: FormWorkspacePageClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const tab = useMemo((): FormWorkspaceTab => {
    const raw = searchParams.get("tab");
    if (raw === "preview" || raw === "design" || raw === "settings" || raw === "fields") return raw;
    return "fields";
  }, [searchParams]);

  const setTab = useCallback(
    (t: FormWorkspaceTab) => {
      const q = new URLSearchParams(searchParams.toString());
      if (t === "fields") q.delete("tab");
      else q.set("tab", t);
      const qs = q.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const editorPreviewHref = `${pathname}?tab=preview`;

  return (
    <FormWorkspacePanel
      variant="page"
      activeTab={tab}
      onTabChange={setTab}
      editorPreviewHref={editorPreviewHref}
      editorPreviewSameTab
      {...props}
    />
  );
}
