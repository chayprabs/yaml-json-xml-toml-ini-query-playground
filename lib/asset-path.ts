const rawBasePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const ASSET_BASE_PATH =
  rawBasePath === "/" ? "" : rawBasePath.replace(/\/$/u, "");

export function getAssetPath(fileName: string): string {
  const normalizedFileName = fileName.replace(/^\/+/u, "");
  return `${ASSET_BASE_PATH}/${normalizedFileName}`.replace(/\/{2,}/gu, "/");
}
