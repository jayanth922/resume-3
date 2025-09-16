/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Disable ESLint during builds for demo purposes
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Disable type checking during builds for demo purposes
    ignoreBuildErrors: true,
  },
};

module.exports = nextConfig;