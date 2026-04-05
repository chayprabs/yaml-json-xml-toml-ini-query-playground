"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");

const MIME = {
  ".wasm": "application/wasm",
  ".js": "application/javascript",
  ".mjs": "application/javascript",
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".json": "application/json",
  ".gz": "application/gzip",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".txt": "text/plain",
};

const root = path.join(__dirname, "..", "out");
const port = Number(process.env.PORT) || 3000;

if (!fs.existsSync(root)) {
  console.error("ERROR: out/ directory not found. Run npm run build first.");
  process.exit(1);
}

http
  .createServer((req, res) => {
    const urlPath = req.url.split("?")[0];
    let filePath = path.join(root, urlPath);

    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, "index.html");
    }

    if (!fs.existsSync(filePath)) {
      filePath = path.join(root, "index.html");
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME[ext] || "application/octet-stream";

    try {
      const content = fs.readFileSync(filePath);
      res.writeHead(200, { "Content-Type": contentType });
      res.end(content);
    } catch (err) {
      res.writeHead(500);
      res.end("Server error");
    }
  })
  .listen(port, "127.0.0.1", () => {
    console.log("Static server ready on http://127.0.0.1:" + port);
    console.log("Serving from: " + root);
  });
