/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // PWA support via next-pwa kan legges til senere
  experimental: {
    optimizePackageImports: ['firebase/firestore', 'firebase/auth'],
  },
};

module.exports = nextConfig;
