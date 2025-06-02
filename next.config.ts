import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '4mb',
    }
  },
  // New location for serverExternalPackages (moved from experimental)
  serverExternalPackages: ['puppeteer-real-browser', 'puppeteer-extra', 'puppeteer'],
  
  // Increased timeout for page generation
  staticPageGenerationTimeout: 180,
  
  // Simplify the webpack configuration
  webpack: (config, { isServer }) => {
    // Only apply these changes on the server side
    if (isServer) {
      // Mark problematic packages as external to prevent bundling
      const originalExternals = config.externals ?? [];
      config.externals = [
        ...(typeof originalExternals === 'function' ? [] : originalExternals),
        'puppeteer-real-browser',
        'puppeteer-extra',
        'puppeteer-extra-plugin-stealth',
        'puppeteer-extra-plugin-adblocker',
        'clone-deep',
        'merge-deep',
        'better-sqlite3', // Add better-sqlite3 as external to avoid compilation issues
      ];
    } else {
      // Client-side fallbacks
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        child_process: false,
        module: false,
        path: false,
        os: false,
        crypto: false,
        util: false,
        sqlite3: false,
        'better-sqlite3': false,
      };
    }

    return config;
  },
  // Skip type checking for faster builds during development
  typescript: {
    ignoreBuildErrors: true,
  }
}

export default nextConfig;
