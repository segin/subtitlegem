import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  
  // Uncomment and set this if deploying to a subdirectory (e.g., '/subtitlegem')
  // basePath: '/subtitlegem',
  
  experimental: {
    proxyClientMaxBodySize: '50gb', // Allow uploads up to 50 GB per file
  },
};

export default nextConfig;