const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const target = process.argv[2];

if (!target) {
  console.error("Usage: node scripts/gzip-file.cjs <file>");
  process.exit(1);
}

const filePath = path.resolve(target);
const gzipPath = `${filePath}.gz`;
const source = fs.readFileSync(filePath);
const compressed = zlib.gzipSync(source, {
  level: zlib.constants.Z_BEST_COMPRESSION,
});

fs.writeFileSync(gzipPath, compressed);
console.log(`Wrote ${gzipPath}`);
