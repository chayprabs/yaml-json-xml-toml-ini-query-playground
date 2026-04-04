const { PHASE_DEVELOPMENT_SERVER } = require("next/constants");

module.exports = (phase) => {
  /** @type {import('next').NextConfig} */
  const nextConfig = {
    output: "export",
    reactStrictMode: true,
  };

  if (phase === PHASE_DEVELOPMENT_SERVER) {
    nextConfig.headers = async () => [
      {
        source: "/yq.wasm",
        headers: [
          {
            key: "Content-Type",
            value: "application/wasm",
          },
        ],
      },
    ];
  }

  return nextConfig;
};
