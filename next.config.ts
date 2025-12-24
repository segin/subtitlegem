import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    serverActions: {
      allowedOrigins: ["*"],
    },
    // @ts-ignore
    allowedDevOrigins: ["localhost:3050", "0.0.0.0:3050"],
  },
};

export default nextConfig;