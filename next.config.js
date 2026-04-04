const { PHASE_DEVELOPMENT_SERVER } = require("next/constants");

module.exports = (phase) => {
  const repoName = process.env.GITHUB_REPOSITORY?.split("/")[1];
  const useGitHubPagesBasePath =
    process.env.GITHUB_ACTIONS === "true" && Boolean(repoName);

  /** @type {import('next').NextConfig} */
  const nextConfig = {
    assetPrefix:
      useGitHubPagesBasePath && repoName ? `/${repoName}` : undefined,
    basePath:
      useGitHubPagesBasePath && repoName ? `/${repoName}` : undefined,
    output: "export",
    reactStrictMode: true,
    trailingSlash: true,
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
