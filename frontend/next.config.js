/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  transpilePackages: [
    'antd',
    '@ant-design/icons',
    '@ant-design/cssinjs',
    '@ant-design/charts',
  ],
  modularizeImports: {
    '@ant-design/icons': {
      transform: '@ant-design/icons/lib/icons/{{member}}',
    },
  },
  experimental: {
    optimizePackageImports: ['antd', '@ant-design/icons'],
  },
};

module.exports = nextConfig;
