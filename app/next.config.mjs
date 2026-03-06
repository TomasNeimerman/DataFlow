/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
<<<<<<< HEAD
  images:{
    unoptimized: true,
  },
  // pageExtensions: ['page.js', 'page.jsx', 'page.ts', 'page.tsx'],
=======
  images: { unoptimized: true },
>>>>>>> 915c66909684db098d8351c18a29db2455c4a985
  reactStrictMode: false,
  swcMinify: true,
};

export default nextConfig;
