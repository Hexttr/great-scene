import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      // Старые и новые ссылки /uploads/* → явная раздача через Route Handler
      { source: "/uploads/:filename", destination: "/api/uploads/:filename" },
    ];
  },
};

export default nextConfig;
