import type { NextConfig } from 'next';

const config: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_DASH0_ENDPOINT: process.env.NEXT_PUBLIC_DASH0_ENDPOINT ?? '',
    NEXT_PUBLIC_DASH0_TOKEN: process.env.NEXT_PUBLIC_DASH0_TOKEN ?? '',
  },
};
export default config;
