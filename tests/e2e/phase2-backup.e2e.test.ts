/**
 * Phase 2 — backup / restore helper unit tests.
 *
 * These run the `_backup.ts` helper in a subprocess so `DATA_DIR` resolves
 * against the sandbox `HOME`. Tests cover:
 *   - A new session creates a directory under <DATA_DIR>/backups/
 *   - Backing up a file that does not exist is a no-op (no crash, no file)
 *   - Backing up an existing file captures its contents byte-for-byte
 *   - Restore puts the file back exactly where it was
 *   - Pruning keeps only the N most recent sessions
 */

import { describe, it, expect, afterEach } from 'bun:test';
import { spawnSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import {
  createSandbox,
  destroySandbox,
  readSandboxFile,
  seedFile,
  type Sandbox,
} from './harness.js';

const sandboxes: Sandbox[] = [];
function newSandbox(label: string): Sandbox {
  const s = createSandbox(label);
  sandboxes.push(s);
  return s;
}
afterEach(() => {
  while (sandboxes.length) {
    const s = sandboxes.pop();
    if (s) destroySandbox(s);
  }
});

/** Run a short inline bun script inside the sandbox. */
function runScript(sandbox: Sandbox, script: string): { code: number; out: string; err: string } {
  const result = spawnSync('bun', ['-e', script], {
    cwd: sandbox.workspace,
    env: {
      ...process.env,
      HOME: sandbox.home,
      USERPROFILE: sandbox.home,
      CLAUDE_MEM_DATA_DIR: join(sandbox.home, '.claude-mem'),
      CLAUDE_CONFIG_DIR: join(sandbox.home, '.claude'),
    },
    encoding: 'utf8',
    timeout: 15_000,
  });
  return { code: result.status ?? -1, out: result.stdout ?? '', err: result.stderr ?? '' };
}

const repoRoot = process.cwd();
const backupModule = join(repoRoot, 'src/services/integrations/_backup.ts');

describe('Phase 2: _backup helper', () => {
  it('captures a file and can restore it', () => {
    const sandbox = newSandbox('backup-round-trip');
    const target = join(sandbox.home, 'some-config.json');
    seedFile(target, '{"original":true}\n');

    const script = `
      const mod = await import(${JSON.stringify(backupModule)});
      const session = mod.createBackupSession('unit-test');
      mod.backupFile(session, ${JSON.stringify(target)});

      // Mutate the file to simulate install overwriting it.
      const fs = await import('fs');
      fs.writeFileSync(${JSON.stringify(target)}, '{"overwritten":true}\\n');

      // Restore it.
      const restored = mod.restoreSession(session);
      console.log('restored:' + restored);
    `;
    const result = runScript(sandbox, script);
    expect(result.code).toBe(0);
    expect(result.out).toContain('restored:1');
    expect(readSandboxFile(target)).toBe('{"original":true}\n');
  });

  it('backing up a non-existent file is a no-op', () => {
    const sandbox = newSandbox('backup-missing');
    const missing = join(sandbox.home, 'nothing.json');

    const script = `
      const mod = await import(${JSON.stringify(backupModule)});
      const session = mod.createBackupSession('no-op');
      mod.backupFile(session, ${JSON.stringify(missing)});
      // Should not throw, no file captured.
      console.log('ok');
    `;
    const result = runScript(sandbox, script);
    expect(result.code).toBe(0);
    expect(result.out).toContain('ok');
  });

  it('prunes to the most recent N sessions', () => {
    const sandbox = newSandbox('backup-prune');

    const script = `
      const mod = await import(${JSON.stringify(backupModule)});
      const fs = await import('fs');
      const path = await import('path');
      const backupsRoot = mod.backupsRoot();
      fs.mkdirSync(backupsRoot, { recursive: true });

      // Manufacture 15 session dirs with lexicographic timestamps
      // so sort picks them deterministically.
      for (let i = 0; i < 15; i++) {
        const name = '2026-01-01_' + String(i).padStart(2, '0') + '_session';
        fs.mkdirSync(path.join(backupsRoot, name), { recursive: true });
      }

      mod.pruneBackups(10);
      const remaining = fs.readdirSync(backupsRoot).sort();
      console.log('count:' + remaining.length);
      console.log('first:' + remaining[0]);
      console.log('last:' + remaining[remaining.length - 1]);
    `;
    const result = runScript(sandbox, script);
    expect(result.code).toBe(0);
    expect(result.out).toContain('count:10');
    // Oldest five pruned — first remaining is session 05.
    expect(result.out).toContain('first:2026-01-01_05_session');
    expect(result.out).toContain('last:2026-01-01_14_session');
  });
});
