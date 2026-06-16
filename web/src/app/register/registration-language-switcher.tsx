"use client";

import { Languages } from "lucide-react";
import type { RegistrationLocale } from "@/lib/registration-i18n";
import { useRegistrationLocale } from "./registration-locale-context";

export function RegistrationLanguageSwitcher({ className = "" }: { className?: string }) {
  const { locale, setLocale, t } = useRegistrationLocale();

  function select(next: RegistrationLocale) {
    if (next !== locale) setLocale(next);
  }

  return (
    <div
      className={`inline-flex items-center gap-1 rounded-full border border-white/25 bg-black/35 p-0.5 text-xs font-semibold shadow-sm backdrop-blur-sm ${className}`}
      role="group"
      aria-label={t("languageSwitcherLabel")}
    >
      <Languages className="ml-2 size-3.5 shrink-0 text-white/70" aria-hidden />
      {(["en", "es"] as const).map((code) => {
        const active = locale === code;
        const label = code === "en" ? t("languageEnglish") : t("languageSpanish");
        return (
          <button
            key={code}
            type="button"
            onClick={() => select(code)}
            aria-pressed={active}
            className={
              active
                ? "rounded-full bg-white px-2.5 py-1 text-neutral-900"
                : "rounded-full px-2.5 py-1 text-white/85 hover:bg-white/10"
            }
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
