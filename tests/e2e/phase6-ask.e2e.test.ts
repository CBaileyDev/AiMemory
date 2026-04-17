/**
 * Phase 6 — `npx claude-mem ask` end-to-end tests.
 *
 * We spin up a tiny Bun HTTP server that mimics the worker's
 * `/api/search` and `/api/ask` endpoints, then run the ask command in
 * a sandboxed subprocess against it. Validates:
 *
 *   - Default (no --model) produces a citation-style answer.
 *   - --json emits a structured payload with `question`, `citations`,
 *     and `synthesis: null` (since no model was asked).
 *   - --model <id> POSTs to /api/ask and embeds the model-synthesized
 *     answer in the output.
 *   - `ask` fails cleanly when the worker is unreachable.
 *   - Missing question prints usage and exits non-zero.
 */

import { describe, it, expect, afterEach } from 'bun:test';
import { spawnSync } from 'child_process';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import {
  createSandbox,
  destroySandbox,
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

const repoRoot = process.cwd();
const askModule = join(repoRoot, 'src/npx-cli/commands/ask.ts');

/** Start a mock worker in a detached bun process. Returns port + kill fn. */
interface MockWorker {
  port: number;
  kill(): void;
}

function startMockWorker(
  sandbox: Sandbox,
  searchPayload: unknown,
  askPayload: unknown,
): Promise<MockWorker> {
  const readyFile = join(sandbox.root, 'worker-ready.txt');
  const killFile = join(sandbox.root, 'worker-kill.txt');

  const serverScript = `
    const { serve } = await import('bun');
    const fs = await import('fs');
    const server = serve({
      port: 0,
      async fetch(req) {
        const url = new URL(req.url);
        if (url.pathname === '/api/search') {
          return new Response(JSON.stringify(${JSON.stringify(searchPayload)}), {
            headers: { 'content-type': 'application/json' },
          });
        }
        if (url.pathname === '/api/ask' && req.method === 'POST') {
          return new Response(JSON.stringify(${JSON.stringify(askPayload)}), {
            headers: { 'content-type': 'application/json' },
          });
        }
        return new Response('not found', { status: 404 });
      },
    });
    fs.writeFileSync(${JSON.stringify(readyFile)}, String(server.port));
    // Poll for a kill signal from the test parent.
    const iv = setInterval(() => {
      if (fs.existsSync(${JSON.stringify(killFile)})) {
        server.stop();
        clearInterval(iv);
        process.exit(0);
      }
    }, 50);
  `;

  // Spawn detached so the test process can continue.
  const child = spawnSync('bun', ['-e', serverScript], {
    cwd: sandbox.workspace,
    encoding: 'utf-8',
    timeout: 1000, // We use a wait loop and kill via file sentinel.
    detached: false,
  });
  // spawnSync with a timeout won't give us a long-lived process. Switch
  // to spawn without sync.
  // Replaced below by a proper async start.
  throw new Error('unreachable — replaced by startMockWorkerAsync');
}

/** Async version — returns a running child + its port. */
async function startMockWorkerAsync(
  sandbox: Sandbox,
  searchPayload: unknown,
  askPayload: unknown,
): Promise<{ port: number; kill: () => void }> {
  const { spawn } = await import('child_process');

  const readyFile = join(sandbox.root, 'worker-ready.txt');
  const killFile = join(sandbox.root, 'worker-kill.txt');

  const serverScript = `
    const { serve } = await import('bun');
    const fs = await import('fs');
    const server = serve({
      port: 0,
      async fetch(req) {
        const url = new URL(req.url);
        if (url.pathname === '/api/search') {
          return new Response(JSON.stringify(${JSON.stringify(searchPayload)}), {
            headers: { 'content-type': 'application/json' },
          });
        }
        if (url.pathname === '/api/ask' && req.method === 'POST') {
          return new Response(JSON.stringify(${JSON.stringify(askPayload)}), {
            headers: { 'content-type': 'application/json' },
          });
        }
        return new Response('not found', { status: 404 });
      },
    });
    fs.writeFileSync(${JSON.stringify(readyFile)}, String(server.port));
    const iv = setInterval(() => {
      if (fs.existsSync(${JSON.stringify(killFile)})) {
        server.stop();
        clearInterval(iv);
        process.exit(0);
      }
    }, 50);
  `;

  const child = spawn('bun', ['-e', serverScript], {
    cwd: sandbox.workspace,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  // Wait for ready file.
  const started = Date.now();
  while (!existsSync(readyFile)) {
    if (Date.now() - started > 5000) {
      child.kill('SIGKILL');
      throw new Error('mock worker failed to start within 5s');
    }
    await new Promise((r) => setTimeout(r, 40));
  }
  const fs = await import('fs');
  const port = parseInt(fs.readFileSync(readyFile, 'utf-8').trim(), 10);

  return {
    port,
    kill: () => {
      try {
        writeFileSync(killFile, 'stop');
      } catch {
        // ignore
      }
      try {
        child.kill();
      } catch {
        // ignore
      }
    },
  };
}

/** Run the ask command inside the sandbox with env pointed at the mock worker. */
function runAsk(sandbox: Sandbox, port: number, argv: string[]): { code: number; out: string; err: string } {
  const script = `
    const mod = await import(${JSON.stringify(askModule)});
    await mod.runAskCommand(${JSON.stringify(argv)});
  `;
  // The ask command checks for plugin install OR a DB at ~/.claude-mem/claude-mem.db.
  // Make the DB file so the check passes.
  const dbDir = join(sandbox.home, '.claude-mem');
  mkdirSync(dbDir, { recursive: true });
  writeFileSync(join(dbDir, 'claude-mem.db'), '\x00'); // any file will do

  const result = spawnSync('bun', ['-e', script], {
    cwd: sandbox.workspace,
    encoding: 'utf-8',
    timeout: 20_000,
    env: {
      ...process.env,
      HOME: sandbox.home,
      USERPROFILE: sandbox.home,
      CLAUDE_CONFIG_DIR: join(sandbox.home, '.claude'),
      CLAUDE_MEM_DATA_DIR: dbDir,
      CLAUDE_MEM_WORKER_PORT: String(port),
      NO_COLOR: '1',
      FORCE_COLOR: '0',
    },
  });
  return {
    code: result.status ?? -1,
    out: result.stdout ?? '',
    err: result.stderr ?? '',
  };
}

const SAMPLE_SEARCH = {
  observations: [
    {
      id: 42,
      project: 'claude-mem',
      type: 'bugfix',
      title: 'Fixed the SQLite migration path',
      subtitle: 'migrations.ts drift on upgrade',
      text: 'Root cause: migration 17 ran twice after a partial failure. Added INSERT OR IGNORE.',
      created_at: '2026-04-10T12:00:00Z',
      created_at_epoch: 1_744_286_400_000,
      score: 0.92,
    },
    {
      id: 43,
      project: 'claude-mem',
      type: 'decision',
      title: 'Decided to keep Bun for the worker',
      subtitle: 'bun:sqlite is required',
      text: 'Evaluated switching to better-sqlite3 — not worth the rewrite.',
      created_at: '2026-04-09T09:30:00Z',
      created_at_epoch: 1_744_191_000_000,
      score: 0.81,
    },
  ],
  sessions: [
    {
      id: 7,
      project: 'claude-mem',
      created_at: '2026-04-10T11:00:00Z',
      created_at_epoch: 1_744_282_800_000,
      score: 0.78,
    },
  ],
  prompts: [],
};

const SAMPLE_ASK = {
  answer:
    'Last week you fixed a SQLite migration drift by making migration 17 idempotent via INSERT OR IGNORE. See [obs#42].',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Phase 6: ask — default (no --model)', () => {
  it('prints citations with observation ids and human titles', async () => {
    const sandbox = newSandbox('ask-default');
    const worker = await startMockWorkerAsync(sandbox, SAMPLE_SEARCH, SAMPLE_ASK);
    try {
      const result = runAsk(sandbox, worker.port, ['how did I fix the migration?']);
      expect(result.code).toBe(0);
      expect(result.out).toContain('Q: how did I fix the migration?');
      expect(result.out).toContain('Fixed the SQLite migration path');
      expect(result.out).toContain('[obs#42]');
      expect(result.out).toContain('[obs#43]');
    } finally {
      worker.kill();
    }
  });

  it('handles an empty result set gracefully', async () => {
    const sandbox = newSandbox('ask-empty');
    const worker = await startMockWorkerAsync(sandbox, {}, SAMPLE_ASK);
    try {
      const result = runAsk(sandbox, worker.port, ['anything']);
      expect(result.code).toBe(0);
      expect(result.out).toContain('No relevant memories found');
    } finally {
      worker.kill();
    }
  });
});

describe('Phase 6: ask --json', () => {
  it('emits a parseable JSON payload with citations and null synthesis', async () => {
    const sandbox = newSandbox('ask-json');
    const worker = await startMockWorkerAsync(sandbox, SAMPLE_SEARCH, SAMPLE_ASK);
    try {
      const result = runAsk(sandbox, worker.port, ['--json', 'what happened?']);
      expect(result.code).toBe(0);
      const parsed = JSON.parse(result.out);
      expect(parsed.question).toBe('what happened?');
      expect(parsed.model).toBeNull();
      expect(parsed.synthesis).toBeNull();
      expect(Array.isArray(parsed.citations)).toBe(true);
      expect(parsed.citations.length).toBeGreaterThan(0);
      expect(parsed.citations[0].key).toMatch(/^(obs|ses|prm)#\d+$/);
    } finally {
      worker.kill();
    }
  });

  it('respects --limit by capping citations', async () => {
    const sandbox = newSandbox('ask-limit');
    const worker = await startMockWorkerAsync(sandbox, SAMPLE_SEARCH, SAMPLE_ASK);
    try {
      const result = runAsk(sandbox, worker.port, ['--json', '--limit', '1', 'what?']);
      expect(result.code).toBe(0);
      const parsed = JSON.parse(result.out);
      expect(parsed.citations).toHaveLength(1);
    } finally {
      worker.kill();
    }
  });
});

describe('Phase 6: ask --model', () => {
  it('forwards to /api/ask and embeds the synthesized answer', async () => {
    const sandbox = newSandbox('ask-model');
    const worker = await startMockWorkerAsync(sandbox, SAMPLE_SEARCH, SAMPLE_ASK);
    try {
      const result = runAsk(sandbox, worker.port, [
        '--model',
        'gemini',
        'how did I fix migrations?',
      ]);
      expect(result.code).toBe(0);
      expect(result.out).toContain(SAMPLE_ASK.answer);
      expect(result.out).toContain('Citations:');
    } finally {
      worker.kill();
    }
  });
});

describe('Phase 6: ask — error handling', () => {
  it('exits 1 and prints usage when no question is given', () => {
    const sandbox = newSandbox('ask-no-question');
    const result = runAsk(sandbox, 39991, []);
    expect(result.code).toBe(1);
    expect(result.err).toContain('Usage: npx claude-mem ask');
  });

  it('fails cleanly when the worker is unreachable', () => {
    const sandbox = newSandbox('ask-no-worker');
    // Port 39991 is the same "definitely not running" port we use for doctor.
    const result = runAsk(sandbox, 39991, ['where is the sqlite fix?']);
    expect(result.code).toBe(1);
    expect(result.err).toContain('Worker is not reachable');
  });
});
