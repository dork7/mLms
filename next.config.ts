import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Student photos may be up to 2 MB (src/core/students/photo.ts), plus multipart overhead.
      bodySizeLimit: "3mb",
    },
  },
};

export default nextConfig;
