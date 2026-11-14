import type { NextConfig } from "next";

/**
 * SITE REGRET se distribuye como sitio estático (carpeta `out/`):
 * sin servidor de cálculo, sin APIs externas y apto para uso offline.
 * Los datos científicos se sirven como archivos propios desde /public/data.
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  basePath: basePath || undefined,
  images: { unoptimized: true },
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
