/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  // pageExtensions: ['page.js', 'page.jsx', 'page.ts', 'page.tsx'],
  images: { unoptimized: true },
  reactStrictMode: false,
  swcMinify: true,
};

export default nextConfig;
