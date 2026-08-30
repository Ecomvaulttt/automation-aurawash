import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist");
const htmlPath = resolve(dist, "index.html");
let html = readFileSync(htmlPath, "utf8");

function sanitizeInlineModule(source) {
  return source
    .replace(/<\/script/gi, "<\\/script")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, (character) =>
      `\\x${character.charCodeAt(0).toString(16).padStart(2, "0")}`,
    );
}

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
    const js = sanitizeInlineModule(readFileSync(resolve(dist, assetPath), "utf8"));
    return `<script type="module">${js}</script>`;
  },
);

html = html.replace(/[ \t]+$/gm, "");

writeFileSync(resolve(root, "aurawash-administratie.html"), html);
