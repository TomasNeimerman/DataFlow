// next.config.mjs

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  serverExternalPackages: [
    'electron',
    'express',
  ],
};

export default nextConfig;