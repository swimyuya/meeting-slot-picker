#!/usr/bin/env node
/**
 * package.json の version を真として、Cargo.toml と tauri.conf.json に同期する。
 * usage: `npm version patch && node scripts/sync-version.mjs`
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(`${root}/package.json`, "utf8"));
const version = pkg.version;
if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version)) {
  console.error(`unexpected version in package.json: ${version}`);
  process.exit(1);
}

// Cargo.toml: [package] の version を更新
const cargoPath = `${root}/src-tauri/Cargo.toml`;
const cargoOrig = readFileSync(cargoPath, "utf8");
const cargoNew = cargoOrig.replace(/^version = ".*"$/m, `version = "${version}"`);
if (cargoOrig === cargoNew) console.warn("Cargo.toml: version line not found / already up to date");
writeFileSync(cargoPath, cargoNew);
console.log(`Cargo.toml -> ${version}`);

// tauri.conf.json: top-level version を更新
const tauriPath = `${root}/src-tauri/tauri.conf.json`;
const tauri = JSON.parse(readFileSync(tauriPath, "utf8"));
tauri.version = version;
writeFileSync(tauriPath, `${JSON.stringify(tauri, null, 2)}\n`);
console.log(`tauri.conf.json -> ${version}`);
