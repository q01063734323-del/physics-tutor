import type { NextConfig } from "next";

const nextConfig: NextConfig = {
<<<<<<< HEAD
  outputFileTracingExcludes: { "*": ["./.local/pdf-imports/**", "./tmp/pdfs/**"] },
=======
>>>>>>> e9b7eb92d3ce579c73cd0d9cb47130480b341024
  async headers() {
    return [
      { source: "/sw.js", headers: [
        { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        { key: "Service-Worker-Allowed", value: "/" },
      ] },
      { source: "/manifest.webmanifest", headers: [
        { key: "Content-Type", value: "application/manifest+json; charset=utf-8" },
        { key: "Cache-Control", value: "no-cache" },
      ] },
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
