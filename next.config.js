/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true, // Temporarily ignore ESLint errors during production builds
  },
  experimental: {
    appDir: true, // Ensure this is enabled if you're using the app directory structure
  },
};

module.exports = config;
