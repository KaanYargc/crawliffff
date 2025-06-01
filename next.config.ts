import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  eslint: {
    ignoreDuringBuilds: true,
  },
  // API zaman aşımı süresini uzat (3 dakika)
  experimental: {
    // Remove deprecated property
    serverActions: {
      bodySizeLimit: '4mb',
    }
  },
  // New location for serverExternalPackages (moved from experimental)
  serverExternalPackages: ['puppeteer-real-browser', 'puppeteer-extra', 'puppeteer'],
  // API zaman aşımı süresi - 180 saniye (3 dakika)
  api: {
    responseLimit: '8mb',
    bodyParser: {
      sizeLimit: '4mb',
    },
    externalResolver: true,
  },
  // Sayfanın yanıt bekleme süresini uzat
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
