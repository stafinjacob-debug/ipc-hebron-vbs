import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import { resolvePublicRegistrationClosedDisplay } from "@/lib/public-registration-closed-display";
import { loadPublicRegistrationPortal } from "@/lib/load-public-registration-portal";
import { legacyVbsBranding } from "@/lib/portal-branding";
import { buildRegistrationPortalShareMetadata } from "@/lib/portal-share-metadata";
import { DynamicRegistrationWizard } from "./dynamic-registration-wizard";
import { RegisterPortalShell } from "./register-portal-shell";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { branding } = await loadPublicRegistrationPortal({ mode: "legacy" });
  const effective = branding.headerLabel ? branding : legacyVbsBranding();
  return buildRegistrationPortalShareMetadata({ branding: effective });
}

export default async function PublicRegisterPage({
  searchParams,
}: {
  searchParams?: Promise<{ payment?: string; season?: string }>;
}) {
  const sp = searchParams ? await searchParams : {};
  const paymentCanceled = sp.payment === "canceled";
  const canceledSeasonId = typeof sp.season === "string" ? sp.season.trim() : "";

  const { seasons, waiverBySeasonId, branding, dbUnavailable } =
    await loadPublicRegistrationPortal({ mode: "legacy" });
  const vbsBranding = legacyVbsBranding();
  const clientSubmitKey = randomUUID();

  const registrationClosedDisplay =
    !dbUnavailable && seasons.length === 0
      ? await resolvePublicRegistrationClosedDisplay()
      : null;

  return (
    <RegisterPortalShell branding={vbsBranding} dbUnavailable={dbUnavailable}>
      <DynamicRegistrationWizard
        seasons={seasons}
        waiverBySeasonId={waiverBySeasonId}
        clientSubmitKey={clientSubmitKey}
        contactEmail={vbsBranding.contactEmail}
        contactPhone={vbsBranding.contactPhone}
        churchDisplayName={vbsBranding.churchDisplayName}
        portalBranding={vbsBranding}
        paymentCanceled={paymentCanceled}
        initialSeasonId={canceledSeasonId || undefined}
        registrationClosedDisplay={registrationClosedDisplay}
      />
    </RegisterPortalShell>
  );
}
