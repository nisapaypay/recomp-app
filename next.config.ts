import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The floating dev badge covers the mobile tab bar; build errors still show.
  devIndicators: false,
  // PDF rendering (report export) runs in Node; keep it out of the bundler.
  serverExternalPackages: ["@react-pdf/renderer"],
  async headers() {
    return [
      {
        // The service worker must always be re-checked so updates are found.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
  cacheComponents: true,
  partialPrefetching: true,
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
