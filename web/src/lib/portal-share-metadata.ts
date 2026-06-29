import type { Metadata } from "next";
import type { PortalBranding } from "@/lib/portal-branding";

/** Open Graph / Twitter metadata for a public registration portal page. */
export function buildRegistrationPortalShareMetadata(args: {
  branding: PortalBranding;
}): Metadata {
  const { branding } = args;
  const shareTitle = branding.headerLabel.trim() || branding.pageTitle;
  const description = branding.pageDescription;

  return {
    title: branding.pageTitle,
    description,
    openGraph: {
      title: shareTitle,
      description,
      type: "website",
    },
    twitter: {
      card: "summary",
      title: shareTitle,
      description,
    },
  };
}
