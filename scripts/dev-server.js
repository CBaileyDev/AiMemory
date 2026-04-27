#!/usr/bin/env node
/**
 * Phase 9 — `npm run dev:server`.
 *
 * Starts the worker against the dev DB on a dedicated dev port so it
 * cannot collide with the developer's real install on port 37777.
 *
 * Defaults:
 *   CLAUDE_MEM_DATA_DIR=~/.claude-mem-dev
 *   CLAUDE_MEM_WORKER_PORT=37780
 *
 * Both are overridable by exporting them before invoking the script.
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DEFAULT_DATA_DIR = path.join(os.homedir(), '.claude-mem-dev');
const DEFAULT_PORT = '37780';

const DATA_DIR = process.env.CLAUDE_MEM_DATA_DIR || DEFAULT_DATA_DIR;
const PORT = process.env.CLAUDE_MEM_WORKER_PORT || DEFAULT_PORT;

if (DATA_DIR === path.join(os.homedir(), '.claude-mem')) {
  console.error('  refusing to start dev worker against ~/.claude-mem (production dir).');
  console.error('  Set CLAUDE_MEM_DATA_DIR to a dev path or leave it unset.');
  process.exit(2);
}

fs.mkdirSync(DATA_DIR, { recursive: true });
ensureDevSettingsFile();

// Seed if the dev DB doesn't exist yet — keeps first-time setup one-step.
const dbPath = path.join(DATA_DIR, 'claude-mem.db');
if (!fs.existsSync(dbPath)) {
  console.log(`  dev DB not found, seeding a fresh one at ${dbPath}`);
  runSeed(['--fresh', '--silent'], launchWorker);
} else {
  runSeed(['--ensure-schema-only', '--silent'], launchWorker);
}

function ensureDevSettingsFile() {
  const settingsPath = path.join(DATA_DIR, 'settings.json');
  let settings = {};
  if (fs.existsSync(settingsPath)) {
    try {
      settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
    } catch {
      settings = {};
    }
  }

  const next = {
    ...settings,
    CLAUDE_MEM_DATA_DIR: DATA_DIR,
    CLAUDE_MEM_WORKER_PORT: PORT,
    CLAUDE_MEM_WORKER_HOST: settings.CLAUDE_MEM_WORKER_HOST || '127.0.0.1',
  };

  if (JSON.stringify(next) !== JSON.stringify(settings)) {
    fs.writeFileSync(settingsPath, JSON.stringify(next, null, 2), 'utf-8');
  }
}

function runSeed(args, onDone) {
  const seed = spawn(
    'bun',
    [path.join('scripts', 'seed-dev-db.js'), ...args],
    {
      cwd: process.cwd(),
      env: { ...process.env, CLAUDE_MEM_DATA_DIR: DATA_DIR },
      stdio: 'inherit',
    },
  );
  seed.on('close', (code) => {
    if (code !== 0) {
      console.error('  dev DB preparation failed; aborting dev server start');
      process.exit(code ?? 1);
    }
    onDone();
  });
  seed.on('error', (err) => {
    console.error('  failed to prepare dev DB:', err.message);
    process.exit(1);
  });
}

function launchWorker() {
  const workerScript = path.join('plugin', 'scripts', 'worker-service.cjs');
  if (!fs.existsSync(workerScript)) {
    console.error(`  worker script not found at ${workerScript}`);
    console.error('  Run `npm run build` first.');
    process.exit(1);
  }

  console.log('');
  console.log(`  dev DB:      ${DATA_DIR}`);
  console.log(`  dev port:    ${PORT}`);
  console.log(`  viewer URL:  http://localhost:${PORT}/`);
  console.log('');

  const child = spawn('bun', [workerScript, 'start'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      CLAUDE_MEM_DATA_DIR: DATA_DIR,
      CLAUDE_MEM_WORKER_PORT: PORT,
    },
    stdio: 'inherit',
  });

  // Forward Ctrl+C cleanly.
  const forward = (sig) => () => child.kill(sig);
  process.on('SIGINT', forward('SIGINT'));
  process.on('SIGTERM', forward('SIGTERM'));

  child.on('close', (code) => process.exit(code ?? 0));
  child.on('error', (err) => {
    console.error('  failed to start dev worker:', err.message);
    process.exit(1);
  });
}
