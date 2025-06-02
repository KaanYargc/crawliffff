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
  // External packages that should not be bundled
  serverExternalPackages: ['puppeteer-real-browser', 'puppeteer-extra', 'puppeteer', 'better-sqlite3'],
  
  // Increased timeout for page generation
  staticPageGenerationTimeout: 180,
  
  // Optimize for Netlify deployment
  distDir: '.next',
  
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
        'better-sqlite3',
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
  // Skip type checking for faster builds
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // Add specific handling for the analyze-products API route
  async headers() {
    return [
      {
        source: '/api/leads/analyze-products/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, max-age=0',
          },
        ],
      },
    ];
  },
  
  // Important for Netlify deployment - creates a standalone build
  output: 'standalone',
  
  // Handle trailing slashes consistently
  trailingSlash: false,
  
  // Set this to true to generate a 404 page
  generateEtags: true,
}

export default nextConfig;
