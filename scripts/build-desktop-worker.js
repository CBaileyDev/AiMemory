#!/usr/bin/env node
/**
 * Compile worker-service into a standalone binary for Tauri's sidecar bundling.
 *
 * Tauri sidecar naming convention: <name>-<rust-target-triple>(.exe)
 * The bare name (`claude-mem-worker`) is what's referenced in tauri.conf.json's
 * `bundle.externalBin` and capabilities — Tauri picks the correct triple at
 * build time based on the host.
 *
 * Usage:
 *   node scripts/build-desktop-worker.js               # current host
 *   node scripts/build-desktop-worker.js darwin-arm64  # explicit target
 *   node scripts/build-desktop-worker.js darwin-x64
 *   node scripts/build-desktop-worker.js win-x64
 *   node scripts/build-desktop-worker.js linux-x64
 */
import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const TARGETS = {
  'darwin-arm64': { bun: 'bun-darwin-arm64', rust: 'aarch64-apple-darwin', ext: '' },
  'darwin-x64':   { bun: 'bun-darwin-x64',   rust: 'x86_64-apple-darwin',  ext: '' },
  'win-x64':      { bun: 'bun-windows-x64',  rust: 'x86_64-pc-windows-msvc', ext: '.exe' },
  'linux-x64':    { bun: 'bun-linux-x64',    rust: 'x86_64-unknown-linux-gnu', ext: '' },
};

function detectHost() {
  const platform = os.platform();
  const arch = os.arch();
  if (platform === 'darwin' && arch === 'arm64') return 'darwin-arm64';
  if (platform === 'darwin' && arch === 'x64')   return 'darwin-x64';
  if (platform === 'win32'  && arch === 'x64')   return 'win-x64';
  if (platform === 'linux'  && arch === 'x64')   return 'linux-x64';
  throw new Error(`Unsupported host: ${platform}-${arch}`);
}

const arg = process.argv[2];
const hostKey = arg && TARGETS[arg] ? arg : detectHost();
const target = TARGETS[hostKey];

const outDir = path.resolve('src-tauri/bin');
fs.mkdirSync(outDir, { recursive: true });

const outFile = path.join(outDir, `claude-mem-worker-${target.rust}${target.ext}`);

console.log(`Building worker for ${hostKey} (${target.bun} -> ${target.rust})`);

execSync(
  `bun build --compile --minify --target=${target.bun} ./src/services/worker-service.ts --outfile ${JSON.stringify(outFile)}`,
  { stdio: 'inherit' }
);

console.log(`Built: ${outFile}`);
