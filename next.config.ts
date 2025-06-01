import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  transpilePackages: [
    'clone-deep',
    'puppeteer-extra-plugin',
    'puppeteer-extra-plugin-stealth',
    'merge-deep'
  ],
  // Enable SWC for most of the app but use Babel for specific packages
  experimental: {
    swcPlugins: [],
    forceSwcTransforms: true, // Enable SWC transforms
  },
  webpack: (config, { isServer }) => {
    // Add handling for CommonJS modules
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
      '.cjs': ['.cts', '.cjs'],
    };
    
    // Add specific rule for clone-deep and related packages
    config.module.rules.push({
      test: /node_modules[/\\](clone-deep|merge-deep|puppeteer-extra-plugin|puppeteer-extra-plugin-stealth)[/\\].*\.js$/,
      loader: 'babel-loader',
      options: {
        presets: ['@babel/preset-env'],
        plugins: ['@babel/plugin-transform-modules-commonjs'],
      },
    });

    // Add fallback for node modules
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        module: false,
        path: false,
      };
    }

    return config;
  },
};

export default nextConfig;
