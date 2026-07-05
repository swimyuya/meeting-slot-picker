#!/usr/bin/env node
/**
 * dist-extension/ を ZIP にまとめて Chrome Web Store に申請可能な形に。
 * 出力: meeting-slot-picker-pro-extension-<version>.zip (リポジトリルート)
 *
 * 事前に `npm run build:extension` で dist-extension/ を作っておくこと。
 */

import { execSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const DIST = resolve(ROOT, "dist-extension");
const PKG = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf8"));
const VERSION = PKG.version;
const ZIP_NAME = `meeting-slot-picker-pro-extension-${VERSION}.zip`;
const ZIP_PATH = resolve(ROOT, ZIP_NAME);

if (!existsSync(DIST)) {
  console.error(`❌ ${DIST} が存在しません。先に \`npm run build:extension\` を実行してください。`);
  process.exit(1);
}

if (existsSync(ZIP_PATH)) {
  rmSync(ZIP_PATH);
}

// dist-extension/ の中身だけを ZIP に (dist-extension/ ディレクトリは含めない)
execSync(`cd "${DIST}" && zip -r "${ZIP_PATH}" ./*`, { stdio: "inherit" });

console.log(`\n✓ Created ${ZIP_NAME}`);
console.log(`  Path: ${ZIP_PATH}`);
console.log(`  → Chrome Web Store Developer Dashboard で「新規アイテム」→ この ZIP を upload`);
