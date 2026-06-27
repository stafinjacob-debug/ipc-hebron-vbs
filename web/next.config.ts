import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@resvg/resvg-js"],
  outputFileTracingIncludes: {
    "/api/mobile/v1/seasons/*/registrations/*/badge": [
      "./node_modules/dejavu-fonts-ttf/ttf/DejaVuSans.ttf",
      "./node_modules/dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf",
      "./public/fonts/badge-print/DejaVuSans.ttf",
      "./public/fonts/badge-print/DejaVuSans-Bold.ttf",
    ],
  },
  experimental: {
    serverActions: {
      /** Public registration background videos allow up to 10 MB; leave headroom for multipart encoding. */
      bodySizeLimit: "12mb",
    },
  },
  async rewrites() {
    return [
      { source: "/basketball", destination: "/register/basketball" },
      { source: "/basketball/:path*", destination: "/register/basketball/:path*" },
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
