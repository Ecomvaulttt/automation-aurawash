import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist");
const htmlPath = resolve(dist, "index.html");
let html = readFileSync(htmlPath, "utf8");

html = html.replace(
  /<link[^>]+href="\.\/(assets\/[^"]+\.css)"[^>]*>/,
  (_tag, assetPath) => {
    const css = readFileSync(resolve(dist, assetPath), "utf8");
    return `<style>${css}</style>`;
  },
);

html = html.replace(
  /<script[^>]+src="\.\/(assets\/[^"]+\.js)"[^>]*><\/script>/,
  (_tag, assetPath) => {
    const js = readFileSync(resolve(dist, assetPath), "utf8");
    return `<script type="module">${js}</script>`;
  },
);

writeFileSync(resolve(root, "aurawash-administratie.html"), html);
