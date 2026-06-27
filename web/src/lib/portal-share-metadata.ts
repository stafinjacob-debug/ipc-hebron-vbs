import type { Metadata } from "next";
import type { PortalBranding } from "@/lib/portal-branding";

const SHARE_IMAGE_WIDTH = 1200;
const SHARE_IMAGE_HEIGHT = 630;

export function registrationPortalShareImagePath(slug: string): string {
  return `/api/register/share-image/${encodeURIComponent(slug)}`;
}

/** Open Graph / Twitter metadata for a public registration portal page. */
export function buildRegistrationPortalShareMetadata(args: {
  branding: PortalBranding;
  shareImageSlug: string;
}): Metadata {
  const { branding, shareImageSlug } = args;
  const shareTitle = branding.headerLabel.trim() || branding.pageTitle;
  const description = branding.pageDescription;
  const shareImage = registrationPortalShareImagePath(shareImageSlug);

  return {
    title: branding.pageTitle,
    description,
    openGraph: {
      title: shareTitle,
      description,
      type: "website",
      images: [
        {
          url: shareImage,
          alt: shareTitle,
          width: SHARE_IMAGE_WIDTH,
          height: SHARE_IMAGE_HEIGHT,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: shareTitle,
      description,
      images: [shareImage],
    },
  };
}
