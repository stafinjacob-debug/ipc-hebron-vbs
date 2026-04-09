"use client";

import type { FormDefinitionV1 } from "@/lib/registration-form-definition";
import { sortSections, fieldsForSection } from "@/lib/registration-form-definition";

export function AdminFormPreview({
  definition,
  formTitle,
  seasonName,
}: {
  definition: FormDefinitionV1;
  formTitle: string;
  seasonName: string;
}) {
  const sections = sortSections(definition);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="rounded-xl border border-brand/20 bg-brand/5 px-5 py-4 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand">Preview</p>
        <h2 className="mt-1 text-xl font-bold">{formTitle}</h2>
        <p className="mt-1 text-sm text-foreground/70">{seasonName}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-foreground/10 p-4 md:col-span-2">
          <p className="text-xs font-semibold uppercase text-foreground/60">Desktop</p>
          <div className="mt-3 space-y-4">
            {sections.map((sec) => (
              <div key={sec.id} className="rounded-lg border border-foreground/10 bg-background p-3">
                <p className="text-sm font-bold">{sec.title}</p>
                {sec.description ? (
                  <p className="mt-1 text-xs text-foreground/70">{sec.description}</p>
                ) : null}
                <p className="mt-2 text-xs text-foreground/50">Audience: {sec.audience}</p>
                <ul className="mt-2 space-y-1 text-sm">
                  {fieldsForSection(definition, sec.id).map((f) => (
                    <li key={f.id} className="flex flex-wrap gap-2 border-t border-foreground/5 pt-1">
                      <span className="font-medium">{f.label}</span>
                      <span className="rounded bg-foreground/10 px-1.5 py-0.5 font-mono text-xs">
                        {f.type}
                      </span>
                      {f.required ? (
                        <span className="text-xs text-red-600 dark:text-red-400">required</span>
                      ) : null}
                      {f.showWhen ? (
                        <span className="text-xs text-foreground/60">
                          if {f.showWhen.fieldKey} = {f.showWhen.equals}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mx-auto w-full max-w-sm rounded-xl border border-foreground/10 p-3 shadow-sm md:col-span-2">
          <p className="text-xs font-semibold uppercase text-foreground/60">Mobile width</p>
          <div className="mt-2 max-h-[420px] space-y-3 overflow-y-auto text-sm">
            {sections.map((sec) => (
              <div key={sec.id} className="rounded-lg border border-foreground/10 p-2">
                <p className="font-bold">{sec.title}</p>
                <ul className="mt-1 space-y-0.5 text-foreground/80">
                  {fieldsForSection(definition, sec.id).map((f) => (
                    <li key={f.id}>
                      · {f.label} <span className="text-foreground/50">({f.type})</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
