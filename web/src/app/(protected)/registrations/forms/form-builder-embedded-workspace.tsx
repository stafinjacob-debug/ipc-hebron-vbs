"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormWorkspacePayload } from "./actions";
import { loadFormWorkspacePayload } from "./actions";
import { FormWorkspacePanel, type FormWorkspaceTab } from "../form-workspace/[seasonId]/form-workspace-client";

export function FormBuilderEmbeddedWorkspace({ seasonId }: { seasonId: string }) {
  const [tab, setTab] = useState<FormWorkspaceTab>("fields");
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [payload, setPayload] = useState<FormWorkspacePayload | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  const goPreviewFromEditor = useCallback(() => setTab("preview"), []);
  const onFormSettingsSaveSuccess = useCallback(() => {
    setReloadTick((t) => t + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const r = await loadFormWorkspacePayload(seasonId);
      if (cancelled) return;
      if (!r.ok) {
        setStatus("error");
        setErrorMessage(r.message);
        setPayload(null);
        return;
      }
      setPayload(r.payload);
      setStatus("ready");
    })();
    return () => {
      cancelled = true;
    };
  }, [seasonId, reloadTick]);

  if (status === "loading") {
    return (
      <div className="rounded-lg border border-foreground/10 bg-foreground/[0.02] px-4 py-8 text-center text-sm text-foreground/65">
        Loading form editor…
      </div>
    );
  }

  if (status === "error" || !payload) {
    return (
      <p className="rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-800 dark:text-red-200">
        {errorMessage ?? "Could not load the form workspace."}
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-foreground/10 bg-surface-elevated p-3 sm:p-4">
      <FormWorkspacePanel
        variant="embed"
        activeTab={tab}
        onTabChange={setTab}
        onEditorPreviewNavigate={goPreviewFromEditor}
        onFormSettingsSaveSuccess={onFormSettingsSaveSuccess}
        {...payload}
      />
    </div>
  );
}
