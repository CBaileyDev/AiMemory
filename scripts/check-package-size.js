#!/usr/bin/env node
/**
 * Phase 8 — package size budget.
 *
 * Runs `npm pack --dry-run --json` and checks the resulting tarball against
 * the limits in `.package-size-budget.json`. Prevents accidental inclusion
 * of `node_modules/`, `.git/`, stray test fixtures, etc.
 *
 * Exit code: 0 when within budget, 1 when over budget.
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const BUDGET_PATH = path.join(REPO_ROOT, '.package-size-budget.json');

function fmtBytes(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function readBudget() {
  if (!fs.existsSync(BUDGET_PATH)) {
    console.error(`  ERROR: budget file missing at ${BUDGET_PATH}`);
    process.exit(1);
  }
  try {
    return JSON.parse(fs.readFileSync(BUDGET_PATH, 'utf-8'));
  } catch (error) {
    console.error(`  ERROR: could not parse ${BUDGET_PATH}: ${error.message}`);
    process.exit(1);
  }
}

function runNpmPack() {
  const result = spawnSync('npm', ['pack', '--dry-run', '--json'], {
    cwd: REPO_ROOT,
    encoding: 'utf-8',
    timeout: 120_000,
    // Never fail stdout capture on Windows due to shell differences.
    shell: process.platform === 'win32',
  });

  if (result.error) {
    console.error(`  ERROR: could not run npm pack: ${result.error.message}`);
    process.exit(1);
  }
  if (typeof result.status === 'number' && result.status !== 0) {
    console.error(`  ERROR: npm pack exited ${result.status}`);
    console.error(result.stderr);
    process.exit(1);
  }

  const parsed = JSON.parse(result.stdout);
  // npm pack --json returns an array with one entry describing the tarball.
  const entry = Array.isArray(parsed) ? parsed[0] : parsed;
  if (!entry) {
    console.error('  ERROR: npm pack --json returned no entries.');
    process.exit(1);
  }
  return entry;
}

function main() {
  const budget = readBudget();
  const pack = runNpmPack();

  const packed = Number(pack.size ?? 0);
  const unpacked = Number(pack.unpackedSize ?? 0);
  const files = Array.isArray(pack.files) ? pack.files.length : (pack.entryCount ?? 0);

  const violations = [];
  if (budget.maxPackedBytes && packed > budget.maxPackedBytes) {
    violations.push(
      `  packed: ${fmtBytes(packed)} exceeds budget ${fmtBytes(budget.maxPackedBytes)}`,
    );
  }
  if (budget.maxUnpackedBytes && unpacked > budget.maxUnpackedBytes) {
    violations.push(
      `  unpacked: ${fmtBytes(unpacked)} exceeds budget ${fmtBytes(budget.maxUnpackedBytes)}`,
    );
  }
  if (budget.maxFileCount && files > budget.maxFileCount) {
    violations.push(`  file count: ${files} exceeds budget ${budget.maxFileCount}`);
  }

  if (violations.length === 0) {
    console.log(
      `  OK: ${fmtBytes(packed)} packed / ${fmtBytes(unpacked)} unpacked / ${files} files ` +
        `(budget: ${fmtBytes(budget.maxPackedBytes)} / ${fmtBytes(budget.maxUnpackedBytes)} / ${budget.maxFileCount}).`,
    );
    process.exit(0);
  }

  console.error('  ERROR: package exceeds size budget.');
  console.error('');
  for (const v of violations) console.error(v);
  console.error('');
  console.error(
    '  To increase the budget, edit .package-size-budget.json with a PR note justifying the bump.',
  );
  console.error(
    '  If the increase is unexpected, inspect `npm pack --dry-run` for stray files.',
  );
  process.exit(1);
}

main();
