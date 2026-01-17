/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  images:{
    unoptimized: true,
  },
  // pageExtensions: ['page.js', 'page.jsx', 'page.ts', 'page.tsx'],
  reactStrictMode: false,
  swcMinify: true,
};

export default nextConfig;