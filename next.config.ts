import type { NextConfig } from "next";
import path from "node:path";

const LOADER = path.resolve(__dirname, 'src/visual-edits/component-tagger-loader.js');

const nextConfig: NextConfig = {
  // Temporary fallback: disable SWC minify so Next uses Babel for minification.
  // Remove this once the native SWC binary issue is resolved.
  swcMinify: false,

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

  // keep original tracing root (preserved from previous file)
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
        loaders: [LOADER],
      },
    },
  },

  // Deployment / experimental settings
  experimental: {
    serverActions: {
      bodySizeLimit: '100mb', // Allow large video uploads
    },
  },
};

export default nextConfig;
