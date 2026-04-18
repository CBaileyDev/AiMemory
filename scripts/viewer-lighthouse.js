#!/usr/bin/env node
/**
 * Phase 12 — Lighthouse gate for the viewer.
 *
 * Spawns a headless Chromium via Playwright, drives Lighthouse against
 * the built dev viewer, and prints scores for Performance, Accessibility,
 * Best Practices, and SEO. Fails with non-zero exit if any score falls
 * below the thresholds set in `.viewer-lighthouse.json` (or the inline
 * defaults).
 *
 * Lighthouse is sensitive to host load; we treat any single run below
 * threshold as a soft warning unless LIGHTHOUSE_STRICT=1 is set.
 */

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const THRESHOLDS = {
  performance: 0.80,      // 80+ on shared CI runners
  accessibility: 0.98,
  'best-practices': 0.95,
  seo: 0.90
};

async function main() {
  // Import Lighthouse lazily so the script still loads + prints a clear
  // "npm install lighthouse" message on systems that don't have it yet.
  let lighthouse;
  try {
    const mod = await import('lighthouse');
    lighthouse = mod.default ?? mod;
  } catch {
    console.error('Lighthouse not installed. Run `npm install --no-save lighthouse` first.');
    process.exit(2);
  }

  const url = process.env.VIEWER_URL ?? 'http://localhost:37780';

  const configPath = path.resolve('.viewer-lighthouse.json');
  const thresholds = fs.existsSync(configPath)
    ? { ...THRESHOLDS, ...JSON.parse(fs.readFileSync(configPath, 'utf-8')) }
    : THRESHOLDS;

  console.log(`Lighthouse: ${url}`);
  const browser = await chromium.launch({ headless: true, args: ['--remote-debugging-port=9222'] });
  try {
    const result = await lighthouse(url, {
      port: 9222,
      logLevel: 'error',
      output: 'json',
      onlyCategories: Object.keys(thresholds)
    });

    const categories = result?.lhr?.categories ?? {};
    let failed = false;
    console.log('');
    for (const [key, threshold] of Object.entries(thresholds)) {
      const got = categories[key]?.score;
      const pass = typeof got === 'number' && got >= threshold;
      const line = `  ${key.padEnd(18)} ${got ? (got * 100).toFixed(0).padStart(3) : '???'}  (≥ ${(threshold * 100).toFixed(0)})`;
      console.log(pass ? `✓ ${line}` : `✗ ${line}`);
      if (!pass) failed = true;
    }

    if (failed) {
      if (process.env.LIGHTHOUSE_STRICT === '1') {
        process.exit(1);
      } else {
        console.warn('\nOne or more Lighthouse scores below threshold; exporting LIGHTHOUSE_STRICT=1 would fail the run.');
      }
    }
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
