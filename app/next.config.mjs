/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  images: { unoptimized: true },
  reactStrictMode: false,
  swcMinify: true,
};

export default nextConfig;
