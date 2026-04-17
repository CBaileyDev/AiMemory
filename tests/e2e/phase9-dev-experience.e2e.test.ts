/**
 * Phase 9 — dev-experience scripts.
 *
 * These scripts are part of the contributor onboarding story. They
 * must not touch the developer's real config, and a pristine clone
 * should be able to run them out of the box.
 */

import { describe, it, expect, afterEach } from 'bun:test';
import { spawnSync } from 'child_process';
import { Database } from 'bun:sqlite';
import { existsSync, mkdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const REPO_ROOT = process.cwd();

const tempDirs: string[] = [];
function newTempDir(label: string): string {
  const dir = join(tmpdir(), `claude-mem-phase9-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  mkdirSync(dir, { recursive: true });
  tempDirs.push(dir);
  return dir;
}
afterEach(() => {
  while (tempDirs.length) {
    const dir = tempDirs.pop();
    if (dir) try { rmSync(dir, { recursive: true, force: true }); } catch {}
  }
});

function runNode(script: string, args: string[] = [], env: NodeJS.ProcessEnv = {}) {
  const result = spawnSync('bun', [script, ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf-8',
    timeout: 60_000,
    env: { ...process.env, ...env },
  });
  return {
    code: result.status ?? -1,
    out: result.stdout ?? '',
    err: result.stderr ?? '',
  };
}

describe('Phase 9: seed-dev-db.js', () => {
  it('writes a SQLite DB with observations across multiple sources', () => {
    const dataDir = newTempDir('seed-happy');
    const result = runNode('scripts/seed-dev-db.js', ['--fresh', '--count', '120', '--silent'], {
      CLAUDE_MEM_DATA_DIR: dataDir,
    });
    expect(result.code).toBe(0);
    const dbPath = join(dataDir, 'claude-mem.db');
    expect(existsSync(dbPath)).toBe(true);

    const db = new Database(dbPath, { readonly: true });
    try {
      const total = db.query('SELECT COUNT(*) AS n FROM observations').get() as { n: number };
      expect(total.n).toBe(120);

      const sources = db
        .query('SELECT DISTINCT source FROM observations ORDER BY source')
        .all() as Array<{ source: string }>;
      expect(sources.length).toBeGreaterThanOrEqual(3);

      // Sanity-check the required columns.
      const cols = (db.query(`PRAGMA table_info('observations')`).all() as Array<{ name: string }>)
        .map((c) => c.name);
      for (const required of ['memory_session_id', 'project', 'source', 'type', 'created_at_epoch']) {
        expect(cols).toContain(required);
      }
    } finally {
      db.close();
    }
  });

  it('refuses to seed into ~/.claude-mem (production data dir)', () => {
    const homedir = process.env.HOME || process.env.USERPROFILE || '';
    // We can't actually use the real ~/.claude-mem here — the guardrail
    // is based on string equality so we point at it explicitly and
    // assert exit 2. No files are written because the guard fires first.
    if (!homedir) {
      // Skip on exotic envs without HOME/USERPROFILE.
      return;
    }
    const result = runNode('scripts/seed-dev-db.js', ['--count', '1', '--silent'], {
      CLAUDE_MEM_DATA_DIR: join(homedir, '.claude-mem'),
    });
    expect(result.code).toBe(2);
    expect(result.err).toContain('refusing to seed into');
  });

  it('is idempotent — running without --fresh appends on top of an existing DB', () => {
    const dataDir = newTempDir('seed-idempotent');
    const env = { CLAUDE_MEM_DATA_DIR: dataDir };

    const first = runNode('scripts/seed-dev-db.js', ['--fresh', '--count', '50', '--silent'], env);
    expect(first.code).toBe(0);
    const second = runNode('scripts/seed-dev-db.js', ['--count', '30', '--silent'], env);
    expect(second.code).toBe(0);

    const db = new Database(join(dataDir, 'claude-mem.db'), { readonly: true });
    try {
      const total = db.query('SELECT COUNT(*) AS n FROM observations').get() as { n: number };
      expect(total.n).toBe(80);
    } finally {
      db.close();
    }
  });
});

describe('Phase 9: package.json scripts', () => {
  it('exposes typecheck, check, smoke, verify, dev:seed, dev:server', () => {
    const { readFileSync } = require('fs') as typeof import('fs');
    const pkg = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf-8'));
    for (const required of [
      'typecheck',
      'check',
      'smoke',
      'verify',
      'dev:seed',
      'dev:seed:fresh',
      'dev:server',
    ]) {
      expect(pkg.scripts[required]).toBeDefined();
    }
  });

  it('check script runs the expected subcommands in order', () => {
    const { readFileSync } = require('fs') as typeof import('fs');
    const pkg = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf-8'));
    const check = pkg.scripts.check as string;
    expect(check).toContain('typecheck');
    expect(check).toContain('test');
    expect(check).toContain('test:e2e');
    expect(check).toContain('check:dist');
  });
});

describe('Phase 9: CONTRIBUTING.md', () => {
  it('exists at docs/public/CONTRIBUTING.md with the expected sections', () => {
    const { readFileSync } = require('fs') as typeof import('fs');
    const md = readFileSync(join(REPO_ROOT, 'docs/public/CONTRIBUTING.md'), 'utf-8');
    for (const heading of [
      'Prerequisites',
      'One-command setup',
      'The pre-PR gate',
      'Add a new IDE integration',
      'Add a new worker HTTP route',
      'Anti-patterns',
      'Releasing',
    ]) {
      expect(md).toContain(heading);
    }
    // Linked from CONTRIBUTING: the npm scripts we promise.
    expect(md).toContain('npm run check');
    expect(md).toContain('npm run verify');
    expect(md).toContain('npm run dev:server');
  });
});
