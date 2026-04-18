/**
 * Global setup for Phase 12 viewer tests.
 *
 * - Creates an isolated tmp data dir and seeds it via
 *   scripts/seed-dev-db.js.
 * - Spawns scripts/dev-server.js on a dedicated test port so it never
 *   collides with a developer's real install (37777) or their own dev
 *   server (37780).
 * - Writes a state file with the pid so global-teardown can stop it.
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PORT = process.env.CLAUDE_MEM_VIEWER_TEST_PORT ?? '37781';
const DATA_DIR =
  process.env.CLAUDE_MEM_VIEWER_TEST_DATA_DIR ??
  fs.mkdtempSync(path.join(os.tmpdir(), 'claude-mem-viewer-test-'));
const STATE_FILE = path.join(DATA_DIR, '.test-state.json');

async function waitForReady(url: string, timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // connection refused while the worker boots — keep polling
    }
    await new Promise(r => setTimeout(r, 250));
  }
  throw new Error(`dev worker did not respond at ${url} within ${timeoutMs}ms`);
}

export default async function globalSetup(): Promise<void> {
  fs.mkdirSync(DATA_DIR, { recursive: true });

  // Seed the DB from scratch.
  const seed = spawn('bun', ['scripts/seed-dev-db.js', '--fresh'], {
    stdio: 'inherit',
    env: { ...process.env, CLAUDE_MEM_DATA_DIR: DATA_DIR }
  });
  await new Promise<void>((resolve, reject) => {
    seed.on('exit', code => (code === 0 ? resolve() : reject(new Error(`seed exited ${code}`))));
  });

  // Start the dev server in the background.
  const out = fs.openSync(path.join(DATA_DIR, 'dev-server.log'), 'a');
  const err = fs.openSync(path.join(DATA_DIR, 'dev-server.log'), 'a');
  const child = spawn('node', ['scripts/dev-server.js'], {
    env: {
      ...process.env,
      CLAUDE_MEM_DATA_DIR: DATA_DIR,
      CLAUDE_MEM_WORKER_PORT: PORT
    },
    stdio: ['ignore', out, err],
    detached: true
  });
  child.unref();

  if (!child.pid) throw new Error('failed to spawn dev server');
  fs.writeFileSync(STATE_FILE, JSON.stringify({ pid: child.pid, dataDir: DATA_DIR, port: PORT }));

  // Expose data dir to the env so tests can reach it if they need to.
  process.env.CLAUDE_MEM_VIEWER_TEST_DATA_DIR = DATA_DIR;
  process.env.CLAUDE_MEM_VIEWER_TEST_PORT = PORT;
  process.env.CLAUDE_MEM_VIEWER_TEST_STATE_FILE = STATE_FILE;

  await waitForReady(`http://localhost:${PORT}/health`);
}
