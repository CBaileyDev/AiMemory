#!/usr/bin/env node
/**
 * Phase 12 — enforces a size budget on the built viewer bundle.
 *
 * Reads `.viewer-size-budget.json` from the repo root, measures the
 * bundle at `plugin/ui/viewer-bundle.js`, and fails with a non-zero
 * exit code if either the minified size or the gzipped size exceeds
 * its budget. On success, prints the measured sizes so CI logs show
 * trends over time.
 *
 * Intended to be wired into CI alongside the Playwright suite so
 * accidental dependency adds surface as a red PR check rather than a
 * slow-growing footprint.
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..');
const BUDGET_PATH = path.join(ROOT, '.viewer-size-budget.json');

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

function main() {
  if (!fs.existsSync(BUDGET_PATH)) {
    fail(`missing ${BUDGET_PATH}. Create one with maxMinifiedBytes and maxGzippedBytes.`);
  }
  const budget = JSON.parse(fs.readFileSync(BUDGET_PATH, 'utf-8'));
  const bundlePath = path.join(ROOT, budget.path ?? 'plugin/ui/viewer-bundle.js');

  if (!fs.existsSync(bundlePath)) {
    fail(`bundle not found at ${bundlePath}. Run \`npm run build\` first.`);
  }

  const raw = fs.readFileSync(bundlePath);
  const rawBytes = raw.length;
  const gzBytes = zlib.gzipSync(raw, { level: 9 }).length;

  const { maxMinifiedBytes, maxGzippedBytes } = budget;
  const rawOk = typeof maxMinifiedBytes !== 'number' || rawBytes <= maxMinifiedBytes;
  const gzOk = typeof maxGzippedBytes !== 'number' || gzBytes <= maxGzippedBytes;

  const pad = (n) => String(n).padStart(8);
  console.log('');
  console.log('  Viewer bundle size budget');
  console.log('  ─────────────────────────');
  console.log(`  file:       ${path.relative(ROOT, bundlePath)}`);
  console.log(`  minified:   ${pad(rawBytes)} B   (budget ${pad(maxMinifiedBytes ?? 0)} B)`);
  console.log(`  gzipped:    ${pad(gzBytes)} B   (budget ${pad(maxGzippedBytes ?? 0)} B)`);
  console.log('');

  if (!rawOk) {
    fail(`viewer bundle is ${rawBytes} B > ${maxMinifiedBytes} B budget (minified).`);
  }
  if (!gzOk) {
    fail(`viewer bundle is ${gzBytes} B > ${maxGzippedBytes} B budget (gzipped).`);
  }

  console.log('✓ Viewer bundle within budget.');
}

main();
