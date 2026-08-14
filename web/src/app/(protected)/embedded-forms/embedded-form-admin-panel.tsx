"use client";

import { useState, useTransition } from "react";
import {
  publishEmbeddedFormAction,
  saveEmbeddedFormSettingsAction,
  setEmbeddedFormStatusAction,
} from "./actions";

export function EmbeddedFormAdminPanel({
  formId,
  title,
  subtitle,
  slug,
  status,
  welcomeMessage,
  confirmationMessage,
  instructions,
  emailFromName,
  emailSubject,
  helpEmail,
  helpPhone,
  applicationNumberPrefix,
  pdfTemplateKey,
  publicUrl,
  publishedVersion,
}: {
  formId: string;
  title: string;
  subtitle: string;
  slug: string;
  status: string;
  welcomeMessage: string;
  confirmationMessage: string;
  instructions: string;
  emailFromName: string;
  emailSubject: string;
  helpEmail: string;
  helpPhone: string;
  applicationNumberPrefix: string;
  pdfTemplateKey: string;
  publicUrl: string;
  publishedVersion: number;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const r = await publishEmbeddedFormAction(formId);
              setMessage(r.ok ? `Published (v${publishedVersion + 1}).` : r.error);
            })
          }
          className="rounded-md bg-brand px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          Publish draft
        </button>
        {status === "PUBLISHED" ? (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const r = await setEmbeddedFormStatusAction(formId, "ARCHIVED");
                setMessage(r.ok ? "Archived." : r.error);
              })
            }
            className="rounded-md border border-foreground/15 px-3 py-2 text-sm font-medium"
          >
            Archive
          </button>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const r = await setEmbeddedFormStatusAction(formId, "PUBLISHED");
                setMessage(r.ok ? "Marked published." : r.error);
              })
            }
            className="rounded-md border border-foreground/15 px-3 py-2 text-sm font-medium"
          >
            Mark published
          </button>
        )}
        {status === "PUBLISHED" ? (
          <button
            type="button"
            className="rounded-md border border-foreground/15 px-3 py-2 text-sm font-medium"
            onClick={async () => {
              await navigator.clipboard.writeText(publicUrl);
              setMessage("Public link copied.");
            }}
          >
            Copy public link
          </button>
        ) : null}
      </div>
      {message ? <p className="text-sm text-foreground/70">{message}</p> : null}

      <form
        className="space-y-4 rounded-xl border border-foreground/10 bg-surface-elevated p-4"
        action={(fd) =>
          startTransition(async () => {
            const r = await saveEmbeddedFormSettingsAction(formId, fd);
            setMessage(r.ok ? "Settings saved." : r.error);
          })
        }
      >
        <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/55">Settings</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block text-foreground/60">Title</span>
            <input name="title" defaultValue={title} required className="w-full rounded-md border border-foreground/15 bg-transparent px-3 py-2" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-foreground/60">Subtitle</span>
            <input name="subtitle" defaultValue={subtitle} className="w-full rounded-md border border-foreground/15 bg-transparent px-3 py-2" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-foreground/60">Public slug</span>
            <input name="slug" defaultValue={slug} required className="w-full rounded-md border border-foreground/15 bg-transparent px-3 py-2" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-foreground/60">Application # prefix</span>
            <input name="applicationNumberPrefix" defaultValue={applicationNumberPrefix} className="w-full rounded-md border border-foreground/15 bg-transparent px-3 py-2" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-foreground/60">Email from name</span>
            <input name="emailFromName" defaultValue={emailFromName} className="w-full rounded-md border border-foreground/15 bg-transparent px-3 py-2" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-foreground/60">Email subject</span>
            <input name="emailSubject" defaultValue={emailSubject} className="w-full rounded-md border border-foreground/15 bg-transparent px-3 py-2" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-foreground/60">Help email</span>
            <input name="helpEmail" defaultValue={helpEmail} className="w-full rounded-md border border-foreground/15 bg-transparent px-3 py-2" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-foreground/60">Help phone</span>
            <input name="helpPhone" defaultValue={helpPhone} className="w-full rounded-md border border-foreground/15 bg-transparent px-3 py-2" />
          </label>
          <label className="block text-sm md:col-span-2">
            <span className="mb-1 block text-foreground/60">PDF template key</span>
            <input name="pdfTemplateKey" defaultValue={pdfTemplateKey} className="w-full rounded-md border border-foreground/15 bg-transparent px-3 py-2" />
          </label>
        </div>
        <label className="block text-sm">
          <span className="mb-1 block text-foreground/60">Welcome message</span>
          <textarea name="welcomeMessage" defaultValue={welcomeMessage} rows={3} className="w-full rounded-md border border-foreground/15 bg-transparent px-3 py-2" />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-foreground/60">Confirmation message</span>
          <textarea name="confirmationMessage" defaultValue={confirmationMessage} rows={2} className="w-full rounded-md border border-foreground/15 bg-transparent px-3 py-2" />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-foreground/60">Instructions (shown on receipt / PDF page 6 context)</span>
          <textarea name="instructions" defaultValue={instructions} rows={3} className="w-full rounded-md border border-foreground/15 bg-transparent px-3 py-2" />
        </label>
        <button type="submit" disabled={pending} className="rounded-md bg-foreground px-3 py-2 text-sm font-semibold text-background disabled:opacity-60">
          Save settings
        </button>
      </form>

      {status === "PUBLISHED" ? (
        <p className="text-sm text-foreground/60">
          Public form:{" "}
          <a href={publicUrl} className="text-brand hover:underline" target="_blank" rel="noreferrer">
            {publicUrl}
          </a>
        </p>
      ) : null}
    </div>
  );
}
