#!/usr/bin/env node
/**
 * Phase 8 — version-drift guard.
 *
 * claude-mem ships the same version number in several files that are
 * independently easy to forget:
 *
 *   - package.json                            (npm)
 *   - plugin/package.json                     (bundled runtime deps)
 *   - plugin/.claude-plugin/plugin.json       (Claude Code plugin manifest)
 *   - .claude-plugin/plugin.json              (marketplace manifest)
 *   - .codex-plugin/plugin.json               (Codex plugin manifest)
 *
 * When these drift, installs succeed but tooling silently reports the wrong
 * version. `prepublishOnly` calls this script so we fail the publish rather
 * than shipping a mismatch.
 *
 * Pure Node.js, no dependencies. Exit code: 0 = versions agree, 1 = drift.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

const FILES_TO_CHECK = [
  'package.json',
  'plugin/package.json',
  'plugin/.claude-plugin/plugin.json',
  '.claude-plugin/plugin.json',
  '.codex-plugin/plugin.json',
];

function readVersion(relativePath) {
  const absolute = path.join(REPO_ROOT, relativePath);
  if (!fs.existsSync(absolute)) {
    return { path: relativePath, version: null, missing: true };
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(absolute, 'utf-8'));
    return { path: relativePath, version: parsed.version ?? null, missing: false };
  } catch (error) {
    return {
      path: relativePath,
      version: null,
      missing: false,
      error: error.message,
    };
  }
}

function main() {
  const entries = FILES_TO_CHECK.map(readVersion);

  const missing = entries.filter((e) => e.missing);
  const corrupt = entries.filter((e) => !e.missing && e.error);
  const versioned = entries.filter(
    (e) => !e.missing && !e.error && e.version !== null,
  );

  for (const entry of corrupt) {
    console.error(`  ERROR: could not parse ${entry.path}: ${entry.error}`);
  }

  const unique = Array.from(new Set(versioned.map((e) => e.version)));

  if (corrupt.length > 0) {
    process.exit(1);
  }

  if (versioned.length === 0) {
    console.error('  ERROR: no version fields found in any tracked file.');
    process.exit(1);
  }

  if (unique.length === 1) {
    console.log(`  OK: all ${versioned.length} tracked files agree on version ${unique[0]}.`);
    if (missing.length > 0) {
      console.log(`  Note: ${missing.length} tracked file(s) not found and skipped:`);
      for (const m of missing) console.log(`    - ${m.path}`);
    }
    process.exit(0);
  }

  console.error('  ERROR: version drift detected across manifests.');
  console.error('');
  for (const entry of versioned) {
    console.error(`    ${entry.version.padEnd(12)}  ${entry.path}`);
  }
  console.error('');
  console.error('  Fix by running a release bump (e.g. `npm version patch`) which');
  console.error('  updates every file, or edit the manifests by hand.');
  process.exit(1);
}

main();
