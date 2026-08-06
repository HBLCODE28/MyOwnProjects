import type { NextConfig } from 'next';

const configuredOrigins = (process.env.TAER_OTI_DEV_ORIGINS || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  allowedDevOrigins: [...new Set([
    'localhost',
    '127.0.0.1',
    '192.168.232.1',
    '10.100.102.16',
    ...configuredOrigins,
  ])],
};

export default nextConfig;
