"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  normalizeRegistrationLocale,
  registrationMessage,
  REGISTRATION_LOCALE_STORAGE_KEY,
  type RegistrationLocale,
  type RegistrationMessageKey,
} from "@/lib/registration-i18n";

type RegistrationLocaleContextValue = {
  locale: RegistrationLocale;
  setLocale: (locale: RegistrationLocale) => void;
  t: (key: RegistrationMessageKey, params?: Record<string, string | number>) => string;
};

const RegistrationLocaleContext = createContext<RegistrationLocaleContextValue | null>(null);

export function RegistrationLocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<RegistrationLocale>("en");

  useEffect(() => {
    try {
      const stored = normalizeRegistrationLocale(localStorage.getItem(REGISTRATION_LOCALE_STORAGE_KEY));
      setLocaleState(stored);
    } catch {
      /* ignore */
    }
  }, []);

  const setLocale = useCallback((next: RegistrationLocale) => {
    setLocaleState(next);
    try {
      localStorage.setItem(REGISTRATION_LOCALE_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
    document.documentElement.lang = next === "es" ? "es" : "en";
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale === "es" ? "es" : "en";
  }, [locale]);

  const t = useCallback(
    (key: RegistrationMessageKey, params?: Record<string, string | number>) =>
      registrationMessage(locale, key, params),
    [locale],
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return (
    <RegistrationLocaleContext.Provider value={value}>{children}</RegistrationLocaleContext.Provider>
  );
}

export function useRegistrationLocale() {
  const ctx = useContext(RegistrationLocaleContext);
  if (!ctx) {
    throw new Error("useRegistrationLocale must be used within RegistrationLocaleProvider");
  }
  return ctx;
}
