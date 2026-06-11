import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingIncludes: {
    "/api/mobile/v1/seasons/*/registrations/*/badge": [
      "./node_modules/dejavu-fonts-ttf/ttf/DejaVuSans.ttf",
      "./node_modules/dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf",
      "./node_modules/@resvg/resvg-js/**/*",
    ],
  },
  experimental: {
    serverActions: {
      /** Public registration background videos allow up to 10 MB; leave headroom for multipart encoding. */
      bodySizeLimit: "12mb",
    },
  },
};

export default nextConfig;
