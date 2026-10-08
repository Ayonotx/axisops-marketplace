import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Dynamic rendering: every request reads the live SQLite marketplace data
  cacheComponents: false,
  async rewrites() {
    return [
      // Digital Asset Links for the Android TWA (Play Store domain verification)
      { source: "/.well-known/assetlinks.json", destination: "/api/assetlinks" },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
