/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  reactStrictMode: true,
};

if (process.env.NODE_ENV === 'development') {
  nextConfig.headers = async () => [
    {
      source: '/yq.wasm',
      headers: [
        {
          key: 'Content-Type',
          value: 'application/wasm',
        },
      ],
    },
  ];
}

module.exports = nextConfig;
