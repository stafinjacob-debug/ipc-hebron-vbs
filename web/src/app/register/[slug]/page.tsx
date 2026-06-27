import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { resolvePublicRegistrationClosedDisplay } from "@/lib/public-registration-closed-display";
import { loadPublicRegistrationPortal } from "@/lib/load-public-registration-portal";
import { normalizePortalSlug } from "@/lib/portal-public-path";
import { buildRegistrationPortalShareMetadata } from "@/lib/portal-share-metadata";
import { DynamicRegistrationWizard } from "../dynamic-registration-wizard";
import { RegisterPortalShell } from "../register-portal-shell";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug: raw } = await params;
  const slug = normalizePortalSlug(raw);
  if (!slug) return { title: "Registration" };
  const { branding } = await loadPublicRegistrationPortal({ mode: "slug", slug });
  return buildRegistrationPortalShareMetadata({ branding, shareImageSlug: slug });
}

export default async function PortalRegisterPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ payment?: string }>;
}) {
  const { slug: raw } = await params;
  const slug = normalizePortalSlug(raw);
  if (!slug) notFound();

  const sp = searchParams ? await searchParams : {};
  const paymentCanceled = sp.payment === "canceled";

  const { seasons, waiverBySeasonId, branding, dbUnavailable } =
    await loadPublicRegistrationPortal({ mode: "slug", slug });

  if (!dbUnavailable && seasons.length === 0) {
    notFound();
  }

  const clientSubmitKey = randomUUID();
  const registrationClosedDisplay =
    !dbUnavailable && seasons.length === 0
      ? await resolvePublicRegistrationClosedDisplay()
      : null;

  return (
    <RegisterPortalShell branding={branding} dbUnavailable={dbUnavailable}>
      <DynamicRegistrationWizard
        seasons={seasons}
        waiverBySeasonId={waiverBySeasonId}
        clientSubmitKey={clientSubmitKey}
        contactEmail={branding.contactEmail}
        contactPhone={branding.contactPhone}
        churchDisplayName={branding.churchDisplayName}
        portalBranding={branding}
        paymentCanceled={paymentCanceled}
        registrationClosedDisplay={registrationClosedDisplay}
      />
    </RegisterPortalShell>
  );
}
