import type { NextConfig } from "next";

const config: NextConfig = {
  poweredByHeader: false,
  output: "standalone",
  reactStrictMode: true,
  images: {
    formats: ["image/avif", "image/webp"],
    qualities: [60, 75],
    deviceSizes: [360, 480, 640, 828, 1080, 1280, 1600],
    imageSizes: [64, 128, 256, 384],
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
  serverExternalPackages: ["pg"],
  experimental: { serverActions: { bodySizeLimit: "13mb" } },
  async headers() {
    return [
      { source: "/images/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] },
    ];
  },
  async redirects() {
    // Old single-page anchors that people may have bookmarked or shared
    return [
      { source: "/index.html", destination: "/", permanent: true },
      { source: "/love-lives-here.html", destination: "/", permanent: true },
    ];
  },
};
export default config;
