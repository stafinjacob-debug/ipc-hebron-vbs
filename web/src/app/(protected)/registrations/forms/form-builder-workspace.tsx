"use client";

import type { ReactNode } from "react";
import { useCallback, useState } from "react";
import { Check, ChevronDown, ChevronRight, Copy, Eye } from "lucide-react";
import Link from "next/link";
import { FormBuilderEmbeddedWorkspace } from "./form-builder-embedded-workspace";

export type FormBuilderSeasonRow =
  | {
      kind: "no-form";
      seasonId: string;
      seasonName: string;
    }
  | {
      kind: "form";
      seasonId: string;
      seasonName: string;
      year: number;
      formTitle: string | null;
      formStatus: string;
      publishedVersion: number | null;
      publicRegistrationOpen: boolean;
      acceptingResponses: boolean;
      updatedAtIso: string;
      publicSignupUrl: string;
      canEdit: boolean;
    };

function workspaceHref(seasonId: string, tab?: "preview" | "settings") {
  const base = `/registrations/form-workspace/${seasonId}`;
  if (tab === "preview") return `${base}?tab=preview`;
  if (tab === "settings") return `${base}?tab=settings`;
  return base;
}

function formatRelativeUpdated(iso: string): string {
  const t = new Date(iso).getTime();
  const diffMs = Date.now() - t;
  const sec = Math.floor(diffMs / 1000);
  if (sec < 45) return "Updated just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `Updated ${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `Updated ${hr} hour${hr === 1 ? "" : "s"} ago`;
  const day = Math.floor(hr / 24);
  if (day < 14) return `Updated ${day} day${day === 1 ? "" : "s"} ago`;
  return `Updated ${new Date(iso).toLocaleDateString()}`;
}

function StatusBadge({
  children,
  tone,
}: {
  children: ReactNode;
  tone: "neutral" | "success" | "warning" | "brand";
}) {
  const cls =
    tone === "success"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
      : tone === "warning"
        ? "border-amber-500/35 bg-amber-500/10 text-amber-900 dark:text-amber-100"
        : tone === "brand"
          ? "border-brand/30 bg-brand/10 text-foreground"
          : "border-foreground/15 bg-foreground/[0.06] text-foreground/80";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${cls}`}>
      {children}
    </span>
  );
}

export function FormBuilderWorkspace({ rows, canEdit }: { rows: FormBuilderSeasonRow[]; canEdit: boolean }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const copyUrl = useCallback(async (url: string, key: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(key);
      window.setTimeout(() => setCopied((c) => (c === key ? null : c)), 2000);
    } catch {
      window.prompt("Copy this link:", url);
    }
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Form builder</h1>
        <p className="mt-1 max-w-2xl text-foreground/70">
          Expand a season to edit fields, preview, design, and settings inline. Use &quot;Open full page&quot; when you
          want the workspace in its own tab.
        </p>
      </div>

      <div className="hidden overflow-hidden rounded-xl border border-foreground/10 md:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-foreground/[0.04] text-xs font-medium uppercase tracking-wide text-foreground/60">
            <tr>
              <th className="w-10 px-3 py-3" aria-hidden />
              <th className="px-4 py-3">Season</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Public signup</th>
              <th className="px-4 py-3">Responses</th>
              <th className="px-4 py-3">Updated</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              if (row.kind === "no-form") {
                return (
                  <tr key={row.seasonId} className="border-t border-foreground/10">
                    <td colSpan={6} className="px-4 py-4">
                      <p className="font-semibold text-foreground">{row.seasonName}</p>
                      <p className="mt-1 text-foreground/60">No form record (sign in as coordinator to initialize).</p>
                    </td>
                  </tr>
                );
              }
              const r = row;
              const expanded = expandedId === r.seasonId;
              return (
                <FragmentRow
                  key={r.seasonId}
                  row={r}
                  expanded={expanded}
                  onToggle={() => setExpandedId((id) => (id === r.seasonId ? null : r.seasonId))}
                  onCopy={() => copyUrl(r.publicSignupUrl, r.seasonId)}
                  copied={copied === r.seasonId}
                  canEdit={canEdit}
                />
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && <p className="px-4 py-8 text-center text-foreground/60">No seasons yet.</p>}
      </div>

      <div className="space-y-3 md:hidden">
        {rows.map((row) =>
          row.kind === "no-form" ? (
            <div key={row.seasonId} className="rounded-xl border border-foreground/10 p-4">
              <p className="font-semibold">{row.seasonName}</p>
              <p className="mt-1 text-sm text-foreground/60">No form record.</p>
            </div>
          ) : (
            <MobileSeasonCard
              key={row.seasonId}
              row={row}
              expanded={expandedId === row.seasonId}
              onToggle={() => setExpandedId((id) => (id === row.seasonId ? null : row.seasonId))}
              onCopy={() => copyUrl(row.publicSignupUrl, `m-${row.seasonId}`)}
              copied={copied === `m-${row.seasonId}`}
              canEdit={canEdit}
            />
          ),
        )}
      </div>
    </div>
  );
}

function FragmentRow({
  row: r,
  expanded,
  onToggle,
  onCopy,
  copied,
  canEdit,
}: {
  row: Extract<FormBuilderSeasonRow, { kind: "form" }>;
  expanded: boolean;
  onToggle: () => void;
  onCopy: () => void;
  copied: boolean;
  canEdit: boolean;
}) {
  return (
    <>
      <tr
        className={`border-t border-foreground/10 transition-colors ${expanded ? "bg-foreground/[0.03]" : "hover:bg-foreground/[0.02]"}`}
      >
        <td className="px-3 py-3 align-top">
          <button
            type="button"
            onClick={onToggle}
            className="rounded-md p-1 text-foreground/60 hover:bg-foreground/10 hover:text-foreground"
            aria-expanded={expanded}
            aria-label={expanded ? "Collapse season" : "Expand season"}
          >
            {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </button>
        </td>
        <td className="px-4 py-3 align-top">
          <button type="button" onClick={onToggle} className="text-left">
            <p className="text-base font-semibold leading-snug text-foreground">{r.seasonName}</p>
            <p className="text-xs text-foreground/50">{r.year}</p>
          </button>
        </td>
        <td className="px-4 py-3 align-top">
          <div className="flex flex-wrap gap-1.5">
            <StatusBadge tone={r.formStatus === "PUBLISHED" ? "success" : r.formStatus === "DRAFT" ? "warning" : "neutral"}>
              {r.formStatus}
            </StatusBadge>
            {r.publishedVersion != null ? (
              <span className="text-[11px] font-medium text-foreground/50">v{r.publishedVersion}</span>
            ) : null}
          </div>
        </td>
        <td className="px-4 py-3 align-top">
          <div className="flex items-center gap-2">
            <StatusBadge tone={r.publicRegistrationOpen ? "success" : "neutral"}>
              {r.publicRegistrationOpen ? "Gate open" : "Gate closed"}
            </StatusBadge>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCopy();
              }}
              className="rounded-md p-1 text-foreground/50 hover:bg-foreground/10 hover:text-foreground"
              title="Copy public signup URL"
            >
              {copied ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
            </button>
          </div>
        </td>
        <td className="px-4 py-3 align-top">
          <StatusBadge tone={r.acceptingResponses ? "success" : "neutral"}>
            {r.acceptingResponses ? "Accepting" : "Not accepting"}
          </StatusBadge>
        </td>
        <td className="px-4 py-3 align-top text-foreground/65">{formatRelativeUpdated(r.updatedAtIso)}</td>
      </tr>
      {expanded ? (
        <tr key={`${r.seasonId}-panel`} className="border-t border-foreground/10 bg-foreground/[0.02]">
          <td colSpan={6} className="px-4 py-4">
            {canEdit ? (
              <FormBuilderEmbeddedWorkspace key={r.seasonId} seasonId={r.seasonId} />
            ) : (
              <div className="rounded-lg border border-foreground/10 bg-background p-4 text-sm">
                <Link href={workspaceHref(r.seasonId, "preview")} className="inline-flex items-center gap-1 font-medium text-brand underline">
                  Form preview
                  <Eye className="size-3.5 shrink-0 opacity-70" aria-hidden />
                </Link>
              </div>
            )}
          </td>
        </tr>
      ) : null}
    </>
  );
}

function MobileSeasonCard({
  row: r,
  expanded,
  onToggle,
  onCopy,
  copied,
  canEdit,
}: {
  row: Extract<FormBuilderSeasonRow, { kind: "form" }>;
  expanded: boolean;
  onToggle: () => void;
  onCopy: () => void;
  copied: boolean;
  canEdit: boolean;
}) {
  return (
    <div className="rounded-xl border border-foreground/10 bg-surface-elevated p-4 shadow-sm">
      <button type="button" onClick={onToggle} className="flex w-full items-start justify-between gap-2 text-left">
        <div>
          <p className="text-lg font-semibold text-foreground">{r.seasonName}</p>
          <p className="text-xs text-foreground/50">{r.year}</p>
        </div>
        {expanded ? <ChevronDown className="size-5 shrink-0 text-foreground/50" /> : <ChevronRight className="size-5 shrink-0 text-foreground/50" />}
      </button>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <StatusBadge tone={r.formStatus === "PUBLISHED" ? "success" : r.formStatus === "DRAFT" ? "warning" : "neutral"}>
          {r.formStatus}
        </StatusBadge>
        <StatusBadge tone={r.publicRegistrationOpen ? "success" : "neutral"}>{r.publicRegistrationOpen ? "Open" : "Closed"}</StatusBadge>
        <StatusBadge tone={r.acceptingResponses ? "success" : "neutral"}>{r.acceptingResponses ? "Live" : "Paused"}</StatusBadge>
      </div>
      <p className="mt-2 text-xs text-foreground/55">{formatRelativeUpdated(r.updatedAtIso)}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {!canEdit ? (
          <Link
            href={workspaceHref(r.seasonId, "preview")}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-foreground/15 px-3 py-2 text-sm font-medium"
          >
            <Eye className="size-4" aria-hidden />
            Form preview
          </Link>
        ) : null}
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex items-center justify-center rounded-lg border border-foreground/15 p-2"
          title="Copy public signup link"
        >
          {copied ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
        </button>
      </div>
      {expanded ? (
        <div className="mt-4 border-t border-foreground/10 pt-4 text-sm">
          {canEdit ? (
            <FormBuilderEmbeddedWorkspace key={r.seasonId} seasonId={r.seasonId} />
          ) : (
            <Link href={workspaceHref(r.seasonId, "preview")} className="inline-flex items-center gap-1 font-medium text-brand underline">
              Form preview
              <Eye className="size-3.5 shrink-0 opacity-70" aria-hidden />
            </Link>
          )}
        </div>
      ) : null}
    </div>
  );
}
