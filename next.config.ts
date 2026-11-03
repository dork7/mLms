import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Leave Request attachments may be up to 5 MB (src/core/leave/attachment.ts), Student
      // photos up to 2 MB (src/core/students/photo.ts), plus multipart overhead.
      bodySizeLimit: "6mb",
    },
  },
};

export default nextConfig;
