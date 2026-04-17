#!/usr/bin/env node
/**
 * Phase 9 — seed the dev database with realistic fixtures.
 *
 * Populates `~/.claude-mem-dev/claude-mem.db` (or the path given by
 * `CLAUDE_MEM_DATA_DIR`) with ~500 observations spread across 5 IDE
 * sources so the viewer is usable immediately on a fresh checkout.
 *
 * The schema is created via `CREATE TABLE IF NOT EXISTS` statements that
 * match the minimum columns the viewer + search routes actually read —
 * we don't duplicate the full migration history because this is seed
 * data for dev, not production. If the DB already exists with real
 * schema, we detect `observations` and insert without altering it.
 *
 * Safe properties:
 *   - Writes only under `CLAUDE_MEM_DATA_DIR` (defaulting to
 *     ~/.claude-mem-dev/), never ~/.claude-mem/.
 *   - Idempotent: `--fresh` recreates from scratch; without it, we
 *     append a new batch with a fresh session id.
 *   - Uses Bun's built-in SQLite — no external deps.
 */

import { Database } from 'bun:sqlite';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// ---------------------------------------------------------------------------
// Resolve paths
// ---------------------------------------------------------------------------

function resolveDataDir() {
  if (process.env.CLAUDE_MEM_DATA_DIR) return process.env.CLAUDE_MEM_DATA_DIR;
  return path.join(os.homedir(), '.claude-mem-dev');
}

const DATA_DIR = resolveDataDir();
const DB_PATH = path.join(DATA_DIR, 'claude-mem.db');

// Guardrail: refuse to touch the production DB dir by accident.
if (DATA_DIR === path.join(os.homedir(), '.claude-mem')) {
  console.error(
    'refusing to seed into ~/.claude-mem — that is your production data dir.',
  );
  console.error('Set CLAUDE_MEM_DATA_DIR to a dev path (default ~/.claude-mem-dev).');
  process.exit(2);
}

fs.mkdirSync(DATA_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// CLI flags
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const FRESH = args.includes('--fresh');
const COUNT = parseIntArg(args, '--count', 500);
const SILENT = args.includes('--silent');

function parseIntArg(argv, flag, fallback) {
  const idx = argv.indexOf(flag);
  if (idx < 0) return fallback;
  const val = parseInt(argv[idx + 1] ?? '', 10);
  return Number.isFinite(val) && val > 0 ? val : fallback;
}

function log(...msg) {
  if (!SILENT) console.log(...msg);
}

// ---------------------------------------------------------------------------
// Fixture content
// ---------------------------------------------------------------------------

const SOURCES = ['claude-code', 'codex-cli', 'gemini-cli', 'kimi', 'cursor'];

const PROJECTS = ['personal/claude-mem', 'personal/blog', 'work/dashboard', 'oss/chroma-client'];

const TITLES_BY_TYPE = {
  bugfix: [
    'Fixed the SQLite migration path',
    'Resolved worker port collision on restart',
    'Corrected timezone handling in archive timestamps',
    'Fixed hook command double-escape on Windows',
    'Repaired MCP server path resolution in dev HOME',
  ],
  decision: [
    'Kept Bun as the worker runtime',
    'Adopted tagged context blocks over free-form prose',
    'Chose file-based plugin distribution for OpenCode',
    'Decided to defer JetBrains support',
    'Adopted Phase 2 Integration contract for all installers',
  ],
  feature: [
    'Added npx claude-mem ask command',
    'Introduced doctor --fix auto-repair',
    'Shipped per-IDE telemetry sources tag',
    'Added backup/restore helper for installers',
    'Wired Kimi integration (CLI + VS Code)',
  ],
  refactor: [
    'Split McpIntegrations.ts into per-IDE files',
    'Consolidated hook-payload handling in gemini adapter',
    'Extracted Integration contract into types.ts',
    'Moved worker-service helpers into dedicated module',
  ],
  discovery: [
    'Cursor stores conversation id under conversation_id, not session_id',
    'Gemini Code Assist VS Code reads settings.json mcpServers',
    'Codex CLI shares config.toml with VS Code extension',
    'Kimi Code for VS Code shares ~/.kimi/mcp.json with CLI',
    'Claude Desktop config path is platform-specific',
  ],
  change: [
    'Updated doctor JSON schema to include sections array',
    'Bumped package size budget to 3 MB',
    'Added provenance to npm publish workflow',
    'Registered MCP server in Gemini settings.json',
  ],
};

const TYPES = Object.keys(TITLES_BY_TYPE);

// Deterministic PRNG for reproducible seeds.
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeObservations(count, rand, nowMs) {
  const rows = [];
  const DAY = 24 * 60 * 60 * 1000;
  const spread = 45 * DAY;

  for (let i = 0; i < count; i++) {
    const type = TYPES[Math.floor(rand() * TYPES.length)];
    const titles = TITLES_BY_TYPE[type];
    const title = titles[Math.floor(rand() * titles.length)];
    const project = PROJECTS[Math.floor(rand() * PROJECTS.length)];
    const source = SOURCES[Math.floor(rand() * SOURCES.length)];
    const createdAt = nowMs - Math.floor(rand() * spread);
    rows.push({
      memory_session_id: `dev-session-${i % 20}`,
      project,
      source,
      text: `${title}. ${syntheticBody(rand)}`,
      type,
      title,
      subtitle: syntheticSubtitle(rand),
      facts: null,
      narrative: null,
      concepts: JSON.stringify(['dev-seed', source, type]),
      files_read: null,
      files_modified: null,
      prompt_number: Math.floor(rand() * 50),
      discovery_tokens: Math.floor(rand() * 4000),
      created_at: new Date(createdAt).toISOString(),
      created_at_epoch: createdAt,
    });
  }
  return rows;
}

function syntheticBody(rand) {
  const sentences = [
    'Root cause traced to a merge conflict in the migration runner.',
    'Verified against the upstream schema before landing.',
    'Covered by a new e2e test in the harness.',
    'Rolled out behind a feature flag for early feedback.',
    'Documented in the team wiki and linked from the PR.',
  ];
  return sentences[Math.floor(rand() * sentences.length)];
}

function syntheticSubtitle(rand) {
  const subs = [
    'tracked via integration-test suite',
    'follow-up to the Phase 2 refactor',
    'one of three related changes this week',
    'covered by snapshot regression',
    null,
  ];
  return subs[Math.floor(rand() * subs.length)];
}

// ---------------------------------------------------------------------------
// Schema bootstrap + insert
// ---------------------------------------------------------------------------

function ensureSchema(db) {
  // Idempotent — only creates tables if they don't exist. Existing
  // production-schema databases are left unchanged.
  //
  // sdk_sessions powers platform_source joins in worker queries
  // (Sources dashboard, context routes). Seeded rows give the viewer
  // a realistic WoW/sparkline surface. Columns match the production
  // migration runner so the worker's migration check is a no-op on
  // seeded databases.
  db.run(`
    CREATE TABLE IF NOT EXISTS sdk_sessions (
      memory_session_id TEXT PRIMARY KEY,
      content_session_id TEXT,
      project TEXT,
      started_at_epoch INTEGER,
      status TEXT DEFAULT 'active',
      platform_source TEXT NOT NULL DEFAULT 'claude'
    )
  `);
  const sdkCols = db.query(`PRAGMA table_info('sdk_sessions')`).all();
  const required = {
    platform_source: `ALTER TABLE sdk_sessions ADD COLUMN platform_source TEXT NOT NULL DEFAULT 'claude'`,
    content_session_id: `ALTER TABLE sdk_sessions ADD COLUMN content_session_id TEXT`,
    status: `ALTER TABLE sdk_sessions ADD COLUMN status TEXT DEFAULT 'active'`,
    started_at_epoch: `ALTER TABLE sdk_sessions ADD COLUMN started_at_epoch INTEGER`
  };
  for (const [col, sql] of Object.entries(required)) {
    if (!sdkCols.some((c) => c.name === col)) db.run(sql);
  }
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_sdk_sessions_platform_source
      ON sdk_sessions (platform_source)
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS observations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      memory_session_id TEXT NOT NULL,
      project TEXT NOT NULL,
      source TEXT,
      text TEXT,
      type TEXT NOT NULL,
      title TEXT,
      subtitle TEXT,
      facts TEXT,
      narrative TEXT,
      concepts TEXT,
      files_read TEXT,
      files_modified TEXT,
      prompt_number INTEGER,
      discovery_tokens INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      created_at_epoch INTEGER NOT NULL
    )
  `);
  // If the table already existed without a `source` column (older dev DBs
  // or the production schema before Phase 4 ships), add it. `ALTER TABLE
  // ADD COLUMN` with `IF NOT EXISTS` is not supported in SQLite, so we
  // check column existence first.
  const cols = db.query(`PRAGMA table_info('observations')`).all();
  if (!cols.some((c) => c.name === 'source')) {
    db.run(`ALTER TABLE observations ADD COLUMN source TEXT`);
  }
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_observations_source
      ON observations (source)
  `);
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_observations_created_at_epoch
      ON observations (created_at_epoch)
  `);
}

function main() {
  if (FRESH && fs.existsSync(DB_PATH)) {
    fs.unlinkSync(DB_PATH);
    log(`  Removed existing dev DB at ${DB_PATH}`);
  }

  const db = new Database(DB_PATH, { create: true });
  db.run('PRAGMA journal_mode=WAL');
  ensureSchema(db);

  const rand = mulberry32(Date.now() >>> 0);
  const rows = makeObservations(COUNT, rand, Date.now());

  const insert = db.prepare(`
    INSERT INTO observations (
      memory_session_id, project, source, text, type, title, subtitle,
      facts, narrative, concepts, files_read, files_modified,
      prompt_number, discovery_tokens, created_at, created_at_epoch
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?
    )
  `);

  // Backfill sdk_sessions so platform_source joins resolve in the
  // Sources dashboard + source-aware filters.
  const sessionUpsert = db.prepare(`
    INSERT OR REPLACE INTO sdk_sessions (memory_session_id, content_session_id, project, started_at_epoch, status, platform_source)
    VALUES (?, ?, ?, ?, 'completed', ?)
  `);
  const sessionAgg = new Map();
  for (const row of rows) {
    const existing = sessionAgg.get(row.memory_session_id);
    if (!existing || row.created_at_epoch < existing.started_at_epoch) {
      sessionAgg.set(row.memory_session_id, {
        memory_session_id: row.memory_session_id,
        project: row.project,
        started_at_epoch: row.created_at_epoch,
        platform_source: row.source
      });
    }
  }
  for (const s of sessionAgg.values()) {
    sessionUpsert.run(s.memory_session_id, s.memory_session_id, s.project, s.started_at_epoch, s.platform_source);
  }

  const txn = db.transaction((batch) => {
    for (const row of batch) {
      insert.run(
        row.memory_session_id,
        row.project,
        row.source,
        row.text,
        row.type,
        row.title,
        row.subtitle,
        row.facts,
        row.narrative,
        row.concepts,
        row.files_read,
        row.files_modified,
        row.prompt_number,
        row.discovery_tokens,
        row.created_at,
        row.created_at_epoch,
      );
    }
  });
  txn(rows);

  const sourceCounts = db
    .query(
      `SELECT source, COUNT(*) AS n FROM observations GROUP BY source ORDER BY n DESC`,
    )
    .all();
  const total = db.query(`SELECT COUNT(*) AS n FROM observations`).get();

  db.close();

  log(`  Seeded ${rows.length} observations into ${DB_PATH}`);
  log(`  Total rows: ${total.n}`);
  for (const row of sourceCounts) {
    log(`    ${String(row.source).padEnd(18)} ${row.n}`);
  }
  log('');
  log('  Point the worker at this DB with:');
  log(`    CLAUDE_MEM_DATA_DIR=${DATA_DIR} npm run dev:server`);
}

main();
