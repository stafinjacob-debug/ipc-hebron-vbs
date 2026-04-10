import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import Link from "next/link";
import {
  ensureRegistrationFormForSeason,
  getEffectiveDefinition,
  isFormRegistrationOpen,
} from "@/lib/ensure-registration-form";
import { prisma } from "@/lib/prisma";
import { rulesFromDb } from "@/lib/public-registration";
import { DynamicRegistrationWizard } from "./dynamic-registration-wizard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Register for VBS | IPC Hebron",
  description: "Sign up your children for Vacation Bible School",
};

const CHURCH_DISPLAY_NAME = "IPC Hebron";

export default async function PublicRegisterPage() {
  const seasons = await prisma.vbsSeason.findMany({
    where: { publicRegistrationOpen: true },
    orderBy: [{ year: "desc" }, { startDate: "desc" }],
    include: { publicRegistrationSettings: true, registrationForm: true },
  });

  const options = [];
  for (const s of seasons) {
    const formRow = s.registrationForm ?? (await ensureRegistrationFormForSeason(s.id, s.name));
    if (formRow.status !== "PUBLISHED") continue;
    if (!isFormRegistrationOpen(formRow)) continue;

    options.push({
      id: s.id,
      name: s.name,
      year: s.year,
      startDate: s.startDate.toISOString(),
      endDate: s.endDate.toISOString(),
      welcomeMessage: formRow.welcomeMessage ?? s.publicRegistrationSettings?.welcomeMessage ?? null,
      backgroundImageUrl:
        s.publicRegistrationSettings?.registrationBackgroundImageUrl ?? null,
      rules: rulesFromDb(s.publicRegistrationSettings),
      formTitle: formRow.title,
      definition: getEffectiveDefinition(formRow, false),
    });
  }

  const contactEmail = process.env.NEXT_PUBLIC_VBS_CONTACT_EMAIL?.trim() ?? "";
  const contactPhone = process.env.NEXT_PUBLIC_VBS_CONTACT_PHONE?.trim() ?? "";
  const clientSubmitKey = randomUUID();

  return (
    <div className="min-h-full bg-background">
      <header className="border-b border-neutral-200/80 bg-white/90 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/90">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-100">{CHURCH_DISPLAY_NAME} VBS</p>
          <Link
            href="/login"
            className="text-xs font-medium text-neutral-500 underline-offset-4 hover:text-neutral-800 hover:underline dark:text-neutral-400 dark:hover:text-neutral-200"
          >
            Staff sign in
          </Link>
        </div>
      </header>

      <div className="px-4 pb-16 pt-8 sm:pb-12 sm:pt-10">
        <DynamicRegistrationWizard
          seasons={options}
          clientSubmitKey={clientSubmitKey}
          contactEmail={contactEmail}
          contactPhone={contactPhone}
          churchDisplayName={CHURCH_DISPLAY_NAME}
        />
      </div>

      <footer className="border-t border-neutral-200/80 bg-white/80 py-6 text-center text-xs text-neutral-500 dark:border-neutral-800 dark:bg-neutral-950/80 dark:text-neutral-400">
        <p className="mx-auto max-w-md px-4">
          Secure registration — your information is used only for this VBS event.{" "}
          {contactEmail || contactPhone ? (
            <>
              Questions?{" "}
              {contactEmail ? (
                <a href={`mailto:${contactEmail}`} className="font-medium text-brand underline">
                  {contactEmail}
                </a>
              ) : null}
              {contactEmail && contactPhone ? " · " : null}
              {contactPhone ? (
                <a href={`tel:${contactPhone.replace(/\D/g, "")}`} className="font-medium text-brand underline">
                  {contactPhone}
                </a>
              ) : null}
            </>
          ) : (
            <>Contact the church office for assistance.</>
          )}
        </p>
      </footer>
    </div>
  );
}
