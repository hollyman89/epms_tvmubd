/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: 'http://localhost:4000/api/v1/:path*',
      },
      {
        source: '/uploads/:path*',
        destination: 'http://localhost:4000/uploads/:path*',
      },
      {
        source: '/socket.io/:path*',
        destination: 'http://localhost:4000/socket.io/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
