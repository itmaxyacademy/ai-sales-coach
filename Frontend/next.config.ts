import type { NextConfig } from "next";

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api").replace(/\/$/, "");

const nextConfig: NextConfig = {
  output: 'standalone',
  devIndicators: false,
  async rewrites() {
    return [{ source: "/api/backend/:path*", destination: `${API_BASE_URL}/:path*` }];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: '/dashboard',
        destination: '/karyawan/dashboard',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
