const withBundleAnalyzer = require("@next/bundle-analyzer")({
  enabled: process.env.ANALYZE === "true",
});

module.exports = withBundleAnalyzer((_phase) => {
  const repoName = process.env.GITHUB_REPOSITORY?.split("/")[1];
  const useGitHubPagesBasePath =
    process.env.GITHUB_PAGES === "true" && Boolean(repoName);
  const basePath =
    useGitHubPagesBasePath && repoName ? `/${repoName}` : undefined;

  /** @type {import('next').NextConfig} */
  const nextConfig = {
    assetPrefix: basePath,
    basePath,
    env: {
      NEXT_PUBLIC_BASE_PATH: basePath ?? "",
    },
    output: "export",
    reactStrictMode: true,
    trailingSlash: true,
  };

  return nextConfig;
});
