/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // PWA support via next-pwa kan legges til senere
  experimental: {
    optimizePackageImports: ['firebase/firestore', 'firebase/auth'],
  },
  // Eksplisitt sett workspace root for å unngå feildeteksjon av parent lockfile
  turbopack: {
    root: __dirname,
  },
};

module.exports = nextConfig;
