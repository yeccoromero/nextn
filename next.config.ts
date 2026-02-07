
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
  experimental: {},
  allowedDevOrigins: ["https://*.cloudworkstations.dev", "http://6000-firebase-vectoria-v15-1756313225924.cluster-qhrn7lb3szcfcud6uanedbkjnm.cloudworkstations.dev", "http://6000-firebase-vectoria-v25-1756843191009.cluster-qhrn7lb3szcfcud6uanedbkjnm.cloudworkstations.dev", "http://6000-firebase-vectoria-v26-1757083540461.cluster-qhrn7lb3szcfcud6uanedbkjnm.cloudworkstations.dev"],
};

export default nextConfig;
