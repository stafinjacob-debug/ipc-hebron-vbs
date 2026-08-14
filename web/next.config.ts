import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@resvg/resvg-js", "sharp"],
  outputFileTracingIncludes: {
    "/api/mobile/v1/seasons/*/registrations/*/badge": [
      "./node_modules/dejavu-fonts-ttf/ttf/DejaVuSans.ttf",
      "./node_modules/dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf",
      "./public/fonts/badge-print/DejaVuSans.ttf",
      "./public/fonts/badge-print/DejaVuSans-Bold.ttf",
    ],
    "/api/register/share-image/[slug]": [
      "./node_modules/sharp/**/*",
      "./node_modules/@img/**/*",
    ],
  },
  experimental: {
    serverActions: {
      /** Embedded form academic docs allow up to 5×5 MB plus passport photo; leave headroom for multipart. */
      bodySizeLimit: "28mb",
    },
  },
  async rewrites() {
    return [
      { source: "/basketball", destination: "/register/basketball" },
      { source: "/basketball/:path*", destination: "/register/basketball/:path*" },
      { source: "/soccer-weekday", destination: "/register/soccer-weekday" },
      { source: "/soccer-weekday/:path*", destination: "/register/soccer-weekday/:path*" },
    ];
  },
  async redirects() {
    return [
      {
        source: "/register/basketball-summer-camp-2026",
        destination: "/basketball",
        permanent: true,
      },
      {
        source: "/register/basketball-summer-camp-2026/:path*",
        destination: "/basketball/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
