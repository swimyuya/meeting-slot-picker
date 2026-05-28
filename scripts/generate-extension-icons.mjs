#!/usr/bin/env node
/**
 * src-tauri/icons/icon.png から Chrome 拡張機能用のアイコンを生成する。
 * 出力: extension/icons/icon-{16,48,128}.png
 *
 * 実行: node scripts/generate-extension-icons.mjs
 */

import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const SRC = resolve(ROOT, "src-tauri/icons/icon.png");
const OUT_DIR = resolve(ROOT, "extension/icons");

const targets = [
  { name: "icon-16.png", size: 16 },
  { name: "icon-48.png", size: 48 },
  { name: "icon-128.png", size: 128 },
];

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  for (const t of targets) {
    const outPath = resolve(OUT_DIR, t.name);
    await sharp(SRC).resize(t.size, t.size, { fit: "cover" }).png({ quality: 90 }).toFile(outPath);
    console.log(`✓ ${t.name} (${t.size}x${t.size})`);
  }
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
