import type { NextConfig } from "next";
import path from "node:path";

const LOADER = path.resolve(__dirname, 'src/visual-edits/component-tagger-loader.js');

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: '**',
      },
    ],
  },
  outputFileTracingRoot: path.resolve(__dirname, '../../'),
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Allow cross-origin requests in development
  allowedDevOrigins: [
    "https://www.orchids.app",
    "https://*.orchids.app",
    "https://*.daytona.works",
  ],
  turbopack: {
    rules: {
      "*.{jsx,tsx}": {
        loaders: [LOADER]
      }
    }
  },
  // Deployment optimizations
  experimental: {
    serverActions: {
      bodySizeLimit: '100mb', // Allow large video uploads
    },
  },
};

export default nextConfig;