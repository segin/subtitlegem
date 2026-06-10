import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Uncomment and set this if deploying to a subdirectory (e.g., '/subtitlegem')
  // basePath: '/subtitlegem',

  experimental: {
    proxyClientMaxBodySize: '50gb', // Allow uploads up to 50 GB per file
  },
  allowedDevOrigins: [
    'mediastar.intranet.talamardevelopments.com',
  ],

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
        ],
      },
    ];
  },
};

export default nextConfig;