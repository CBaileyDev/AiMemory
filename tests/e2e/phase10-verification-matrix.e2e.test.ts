/**
 * Phase 10 — verification-matrix script end-to-end tests.
 *
 * Exercises `scripts/verification-matrix.js` directly rather than
 * re-implementing the matrix logic. The script is the actual pre-ship
 * gate, so the tests must match its real behavior.
 */

import { describe, it, expect } from 'bun:test';
import { spawnSync } from 'child_process';

const REPO_ROOT = process.cwd();

function runMatrix(args: string[]): { code: number; out: string; err: string } {
  const result = spawnSync('node', ['scripts/verification-matrix.js', ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf-8',
    timeout: 120_000,
  });
  return {
    code: result.status ?? -1,
    out: result.stdout ?? '',
    err: result.stderr ?? '',
  };
}

describe('Phase 10: verification matrix', () => {
  it('passes for every integration registered in the REGISTRY', () => {
    const result = runMatrix([]);
    expect(result.code).toBe(0);
    expect(result.out).toContain('Phase 10 verification matrix');
    // 15 IDEs as of this commit — the assertion checks the human
    // summary line rather than the raw count to avoid coupling too
    // tightly to the current integration inventory.
    expect(result.out).toMatch(/OK: \d+\/\d+ integrations verified\./);
  });

  it('emits a parseable JSON report under --json', () => {
    const result = runMatrix(['--json']);
    expect(result.code).toBe(0);
    const parsed = JSON.parse(result.out);
    expect(parsed.passed).toBe(true);
    expect(parsed.count).toBeGreaterThan(5);
    expect(Array.isArray(parsed.results)).toBe(true);

    for (const row of parsed.results) {
      expect(typeof row.ide).toBe('string');
      expect(typeof row.passed).toBe('boolean');
      expect(row.checks).toBeDefined();
      expect(typeof row.checks.install).toBe('boolean');
      expect(typeof row.checks.doctor).toBe('boolean');
      expect(typeof row.checks.uninstallSymmetric).toBe('boolean');
    }
  });

  it('can narrow to a single IDE via --ide', () => {
    const result = runMatrix(['--ide', 'gemini-cli', '--json']);
    expect(result.code).toBe(0);
    const parsed = JSON.parse(result.out);
    expect(parsed.count).toBe(1);
    expect(parsed.results[0].ide).toBe('gemini-cli');
  });

  it('rejects unknown IDEs with a clear error', () => {
    const result = runMatrix(['--ide', 'made-up-ide']);
    expect(result.code).toBe(2);
    expect(result.err).toContain('unknown IDE');
  });
});
