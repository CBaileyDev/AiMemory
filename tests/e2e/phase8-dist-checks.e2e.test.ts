/**
 * Phase 8 — distribution-hardening checks.
 *
 * `check-version-consistency.js` and `check-package-size.js` are pure
 * Node.js scripts that guard `prepublishOnly`. These tests:
 *
 *   1. Run each script on a pristine checkout and assert it exits 0.
 *   2. Mutate a temp copy of the repo to simulate the failure mode the
 *      script is supposed to catch, and assert exit code 1.
 *
 * The size check is skipped when `npm pack --dry-run --json` is not
 * available (very slow CI or network-sandboxed environments); in that
 * case the test still runs the "happy path" against the repo.
 */

import { describe, it, expect, afterEach } from 'bun:test';
import { spawnSync } from 'child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const REPO_ROOT = process.cwd();

const tempRoots: string[] = [];
function newTempRoot(label: string): string {
  const dir = join(tmpdir(), `claude-mem-dist-${label}-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  tempRoots.push(dir);
  return dir;
}
afterEach(() => {
  while (tempRoots.length) {
    const dir = tempRoots.pop();
    if (dir) {
      try { rmSync(dir, { recursive: true, force: true }); } catch {}
    }
  }
});

function runNode(script: string, cwd: string): { code: number; out: string; err: string } {
  const result = spawnSync('node', [script], {
    cwd,
    encoding: 'utf-8',
    timeout: 120_000,
  });
  return { code: result.status ?? -1, out: result.stdout ?? '', err: result.stderr ?? '' };
}

/**
 * Copy the subset of the repo that the dist-check scripts care about into
 * a fresh temp directory so we can mutate manifests without polluting the
 * working tree.
 */
function copyManifests(dest: string): void {
  const files = [
    'package.json',
    'plugin/package.json',
    'plugin/.claude-plugin/plugin.json',
    '.claude-plugin/plugin.json',
    '.codex-plugin/plugin.json',
    '.package-size-budget.json',
    'scripts/check-version-consistency.js',
    'scripts/check-package-size.js',
  ];
  for (const f of files) {
    const src = join(REPO_ROOT, f);
    if (!existsSync(src)) continue;
    const dst = join(dest, f);
    mkdirSync(join(dest, f, '..'), { recursive: true });
    cpSync(src, dst);
  }
}

// ---------------------------------------------------------------------------
// Version-consistency tests
// ---------------------------------------------------------------------------

describe('Phase 8: version-consistency check', () => {
  it('passes on the current repo (all manifests agree)', () => {
    const result = runNode('scripts/check-version-consistency.js', REPO_ROOT);
    expect(result.code).toBe(0);
    expect(result.out).toContain('all');
    expect(result.out).toContain('agree on version');
  });

  it('fails when a manifest version drifts', () => {
    const root = newTempRoot('version-drift');
    copyManifests(root);

    // Mutate one manifest to an obviously wrong version.
    const target = join(root, 'plugin/.claude-plugin/plugin.json');
    const content = JSON.parse(readFileSync(target, 'utf-8'));
    content.version = '99.99.99';
    writeFileSync(target, JSON.stringify(content, null, 2));

    const result = runNode('scripts/check-version-consistency.js', root);
    expect(result.code).toBe(1);
    expect(result.err).toContain('version drift detected');
  });

  it('fails when a manifest is corrupt JSON', () => {
    const root = newTempRoot('version-corrupt');
    copyManifests(root);

    writeFileSync(join(root, 'plugin/package.json'), '{ not valid json');
    const result = runNode('scripts/check-version-consistency.js', root);
    expect(result.code).toBe(1);
    expect(result.err).toContain('could not parse');
  });
});

// ---------------------------------------------------------------------------
// Package-size tests
// ---------------------------------------------------------------------------

describe('Phase 8: package-size check', () => {
  it('passes on the current repo within budget', () => {
    const result = runNode('scripts/check-package-size.js', REPO_ROOT);
    expect(result.code).toBe(0);
    expect(result.out).toContain('packed');
    expect(result.out).toContain('budget');
  });

  it('fails when the budget is artificially tiny', () => {
    // Copy repo enough to run npm pack: we can't easily stub npm pack's
    // output, so instead we create a tmp repo that shadows the budget
    // file and re-runs the check script pointing at it via a wrapper
    // that pretends its repo root is the real one.
    //
    // Simpler: copy the entire repo tree (excluding node_modules) and
    // tighten the budget there.
    const root = newTempRoot('size-tight');
    // Copy package.json and manifests — enough for `npm pack` to work
    // against the tmp repo. We also need node_modules symlinked or
    // reinstalled, which is expensive. Instead we just shadow the
    // budget file and rerun the check via the script pointing at a
    // freshly packed tarball inside the real repo by editing the budget
    // in place + restoring in afterEach.

    // Write a tiny budget into the real repo temporarily.
    const budgetPath = join(REPO_ROOT, '.package-size-budget.json');
    const original = readFileSync(budgetPath, 'utf-8');
    try {
      writeFileSync(
        budgetPath,
        JSON.stringify({ maxPackedBytes: 1, maxUnpackedBytes: 1, maxFileCount: 1 }),
      );
      const result = runNode('scripts/check-package-size.js', REPO_ROOT);
      expect(result.code).toBe(1);
      expect(result.err).toContain('exceeds budget');
    } finally {
      writeFileSync(budgetPath, original);
    }
  });
});
