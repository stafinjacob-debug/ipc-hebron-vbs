import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    serverActions: {
      /** Public registration background videos allow up to 10 MB; leave headroom for multipart encoding. */
      bodySizeLimit: "12mb",
    },
  },
};

export default nextConfig;
