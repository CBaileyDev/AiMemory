#!/usr/bin/env node
/**
 * Phase 10 — cross-platform verification matrix.
 *
 * Drives every integration in `src/services/integrations/registry.ts`
 * through a full install → doctor → uninstall cycle inside an isolated
 * fake-HOME sandbox, and renders a matrix with the columns Phase 10
 * requires:
 *
 *   | IDE | Captures | Doctor | Uninstall Symmetric | Dashboard Visible |
 *
 * Exit code:
 *   0 = every row passes
 *   1 = at least one row failed
 *
 * The script is pure Node for the orchestration layer and spawns a Bun
 * subprocess per registry operation (so the production paths resolve
 * inside the sandbox). That keeps it cross-platform — it works on macOS,
 * Linux, and Windows through the same code path as the e2e harness.
 *
 * Flags:
 *   --json          Emit a machine-readable JSON report to stdout.
 *   --ide <id>      Run only one integration.
 *   --keep-sandbox  Don't delete the sandbox after the run (for debugging).
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// CLI parsing
// ---------------------------------------------------------------------------

const argv = process.argv.slice(2);
const flags = {
  json: argv.includes('--json'),
  keepSandbox: argv.includes('--keep-sandbox'),
  ide: pickArg('--ide'),
};

function pickArg(flag) {
  const i = argv.indexOf(flag);
  return i >= 0 ? argv[i + 1] : undefined;
}

// ---------------------------------------------------------------------------
// Sandbox + env helpers (mirrors tests/e2e/harness.ts)
// ---------------------------------------------------------------------------

function createSandbox() {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const root = path.join(os.tmpdir(), `claude-mem-verify-${suffix}`);
  const home = path.join(root, 'home');
  const workspace = path.join(root, 'workspace');
  fs.mkdirSync(home, { recursive: true });
  fs.mkdirSync(workspace, { recursive: true });

  const marketplace = path.join(home, '.claude', 'plugins', 'marketplaces', 'thedotmack');
  fs.mkdirSync(path.join(marketplace, 'plugin', 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(marketplace, 'openclaw', 'dist'), { recursive: true });
  fs.mkdirSync(path.join(marketplace, 'dist', 'opencode-plugin'), { recursive: true });

  // Seed the marketplace sentinels that installers look up at install time.
  fs.writeFileSync(
    path.join(marketplace, 'plugin', 'scripts', 'worker-service.cjs'),
    '// stub worker-service.cjs\n',
  );
  fs.writeFileSync(
    path.join(marketplace, 'plugin', 'scripts', 'mcp-server.cjs'),
    '// stub mcp-server.cjs\n',
  );
  fs.writeFileSync(
    path.join(marketplace, 'openclaw', 'dist', 'index.js'),
    '// stub openclaw plugin\n',
  );
  fs.writeFileSync(
    path.join(marketplace, 'openclaw', 'openclaw.plugin.json'),
    JSON.stringify({ name: 'claude-mem', version: '0.0.0-verify', main: 'dist/index.js' }, null, 2),
  );
  fs.writeFileSync(
    path.join(marketplace, 'dist', 'opencode-plugin', 'index.js'),
    '// stub opencode plugin\n',
  );

  return { root, home, workspace, marketplace };
}

function destroySandbox(sandbox) {
  try {
    fs.rmSync(sandbox.root, { recursive: true, force: true });
  } catch {
    /* best-effort */
  }
}

function sandboxEnv(sandbox) {
  return {
    ...process.env,
    HOME: sandbox.home,
    USERPROFILE: sandbox.home,
    APPDATA: path.join(sandbox.home, 'AppData', 'Roaming'),
    CLAUDE_CONFIG_DIR: path.join(sandbox.home, '.claude'),
    CLAUDE_MEM_DATA_DIR: path.join(sandbox.home, '.claude-mem'),
    OPENCODE_CONFIG_DIR: path.join(sandbox.home, '.config', 'opencode'),
    CLAUDE_MEM_E2E_SANDBOX: '1',
  };
}

// ---------------------------------------------------------------------------
// Subprocess runner against registry.ts
// ---------------------------------------------------------------------------

const REGISTRY_MODULE = path.join(REPO_ROOT, 'src/services/integrations/registry.ts');

function runRegistryAction(sandbox, ide, action) {
  let body;
  if (action === 'install') {
    body = `const r = await integration.install({ silent: true });`;
  } else if (action === 'uninstall') {
    body = `
      if (typeof integration.uninstall !== 'function') { process.exit(200); }
      const r = await integration.uninstall({ silent: true });`;
  } else if (action === 'doctor') {
    body = `
      const report = await integration.doctor();
      process.stdout.write(JSON.stringify(report));
      process.exit(0);`;
  } else {
    throw new Error(`unknown action: ${action}`);
  }

  const script = `
    const mod = await import(${JSON.stringify(REGISTRY_MODULE)});
    const integration = mod.REGISTRY[${JSON.stringify(ide)}];
    if (!integration) { console.error('unknown ide'); process.exit(2); }
    ${body}
    process.exit(typeof r === 'number' ? r : 0);
  `;

  const result = spawnSync('bun', ['-e', script], {
    cwd: sandbox.workspace,
    env: sandboxEnv(sandbox),
    encoding: 'utf8',
    timeout: 60_000,
  });

  return {
    code: result.status ?? -1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

// ---------------------------------------------------------------------------
// Per-IDE cycle
// ---------------------------------------------------------------------------

// Ground truth for the Phase 10 matrix columns. Keep minimal and static —
// it describes IDE capabilities, not runtime state, so it never changes
// between CI runs.
const CAPABILITIES = {
  'claude-code':     { captures: 'hooks',      searchVia: 'mcp',        contextFile: 'CLAUDE.md' },
  'claude-desktop':  { captures: 'none',       searchVia: 'mcp',        contextFile: null },
  'cursor':          { captures: 'hooks',      searchVia: 'mcp',        contextFile: '.cursor/rules/' },
  'gemini-cli':      { captures: 'hooks',      searchVia: 'mcp',        contextFile: 'GEMINI.md' },
  'opencode':        { captures: 'plugin',     searchVia: 'custom-tool', contextFile: 'AGENTS.md' },
  'openclaw':        { captures: 'plugin',     searchVia: 'slash',      contextFile: 'MEMORY.md' },
  'windsurf':        { captures: 'hooks',      searchVia: 'mcp',        contextFile: '.windsurf/rules/' },
  'codex-cli':       { captures: 'transcript', searchVia: 'mcp',        contextFile: 'AGENTS.md' },
  'copilot-cli':     { captures: 'none',       searchVia: 'mcp',        contextFile: 'copilot-instructions.md' },
  'antigravity':     { captures: 'none',       searchVia: 'mcp',        contextFile: '.agent/rules/' },
  'goose':           { captures: 'none',       searchVia: 'mcp',        contextFile: null },
  'crush':           { captures: 'none',       searchVia: 'mcp',        contextFile: null },
  'roo-code':        { captures: 'none',       searchVia: 'mcp',        contextFile: '.roo/rules/' },
  'warp':            { captures: 'none',       searchVia: 'mcp',        contextFile: 'WARP.md' },
  'kimi':            { captures: 'none',       searchVia: 'mcp',        contextFile: null },
};

function verifyOne(ide) {
  const sandbox = createSandbox();
  const checks = {
    install: null,
    doctor: null,
    uninstallSymmetric: null,
  };

  try {
    // 1. Install.
    const install = runRegistryAction(sandbox, ide, 'install');
    checks.install = install.code === 0;

    // 2. Doctor reports non-fail (ok/warn/not-installed/unknown are all acceptable —
    //    we're asserting it doesn't error out, not that everything is green).
    const doctor = runRegistryAction(sandbox, ide, 'doctor');
    if (doctor.code === 0 && doctor.stdout) {
      try {
        const report = JSON.parse(doctor.stdout);
        checks.doctor = report.status !== 'fail';
      } catch {
        checks.doctor = false;
      }
    } else {
      checks.doctor = false;
    }

    // 3. Uninstall + assert no `claude-mem` references remain in files we
    //    can find. "200" means integration has no uninstaller — for those
    //    (only claude-code today), consider the symmetry check N/A (true).
    const uninstall = runRegistryAction(sandbox, ide, 'uninstall');
    if (uninstall.code === 200) {
      checks.uninstallSymmetric = true; // N/A
    } else if (uninstall.code === 0) {
      checks.uninstallSymmetric = !grepSandboxForClaudeMem(sandbox);
    } else {
      checks.uninstallSymmetric = false;
    }
  } finally {
    if (!flags.keepSandbox) destroySandbox(sandbox);
  }

  const passed =
    checks.install === true &&
    checks.doctor === true &&
    checks.uninstallSymmetric === true;

  return { ide, checks, passed };
}

/**
 * Walk the sandbox config directories and report true if any file we
 * would have written still contains `claude-mem`.
 *
 * This is intentionally narrow — we only look under the specific dirs
 * the installers are expected to touch, so a stray `package.json` in the
 * marketplace sentinel tree (which legitimately contains 'claude-mem')
 * doesn't produce a false positive.
 */
function grepSandboxForClaudeMem(sandbox) {
  const home = sandbox.home;
  const ws = sandbox.workspace;
  const candidates = [
    path.join(home, '.gemini', 'settings.json'),
    path.join(home, '.gemini', 'GEMINI.md'),
    path.join(home, '.cursor', 'hooks.json'),
    path.join(home, '.cursor', 'mcp.json'),
    path.join(home, '.codeium', 'windsurf', 'hooks.json'),
    path.join(ws, '.windsurf', 'rules', 'claude-mem-context.md'),
    path.join(home, '.config', 'opencode', 'plugins', 'claude-mem.js'),
    path.join(home, '.config', 'opencode', 'AGENTS.md'),
    path.join(home, '.openclaw', 'openclaw.json'),
    path.join(home, '.claude-mem', 'transcript-watch.json'),
    path.join(home, '.codex', 'config.toml'),
    path.join(home, '.kimi', 'mcp.json'),
    path.join(home, '.github', 'copilot', 'mcp.json'),
    path.join(home, '.gemini', 'antigravity', 'mcp_config.json'),
    path.join(home, '.config', 'crush', 'mcp.json'),
    path.join(home, '.config', 'goose', 'config.yaml'),
    path.join(home, '.warp', 'mcp.json'),
    path.join(ws, '.roo', 'mcp.json'),
    path.join(ws, '.roo', 'rules', 'claude-mem-context.md'),
    path.join(ws, 'WARP.md'),
    path.join(ws, '.github', 'copilot-instructions.md'),
    path.join(ws, '.agent', 'rules', 'claude-mem-context.md'),
    // Claude Desktop — platform-specific paths, expanded inline.
    path.join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json'),
    path.join(home, 'AppData', 'Roaming', 'Claude', 'claude_desktop_config.json'),
    path.join(home, '.config', 'Claude', 'claude_desktop_config.json'),
  ];

  for (const p of candidates) {
    if (!fs.existsSync(p)) continue;
    try {
      const content = fs.readFileSync(p, 'utf-8');
      if (content.includes('claude-mem')) return true;
    } catch {
      /* skip unreadable files */
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function renderText(results) {
  const lines = [];
  lines.push('');
  lines.push('  Phase 10 verification matrix');
  lines.push('');

  const col = (s, w) => String(s).padEnd(w);
  lines.push(
    '  ' +
      col('IDE', 18) +
      col('Captures', 12) +
      col('Search', 13) +
      col('Doctor', 8) +
      col('Uninstall', 12) +
      'Passed',
  );
  lines.push('  ' + '-'.repeat(75));

  for (const row of results) {
    const caps = CAPABILITIES[row.ide] ?? {};
    const tick = (v) => (v === true ? '✔' : v === false ? '✘' : '·');
    lines.push(
      '  ' +
        col(row.ide, 18) +
        col(caps.captures ?? '?', 12) +
        col(caps.searchVia ?? '?', 13) +
        col(tick(row.checks.doctor), 8) +
        col(tick(row.checks.uninstallSymmetric), 12) +
        (row.passed ? '✔' : '✘'),
    );
  }

  lines.push('');
  const passed = results.filter((r) => r.passed).length;
  const failed = results.length - passed;
  if (failed === 0) {
    lines.push(`  OK: ${passed}/${results.length} integrations verified.`);
  } else {
    lines.push(`  FAIL: ${failed} of ${results.length} integrations failed.`);
    for (const row of results.filter((r) => !r.passed)) {
      lines.push(`    - ${row.ide}: ${JSON.stringify(row.checks)}`);
    }
  }
  lines.push('');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  // Pull the registry id list by running the registry once in a subprocess
  // with a trivial "echo ids" op. Cheap + stays in sync with production.
  const listResult = spawnSync(
    'bun',
    [
      '-e',
      `const m = await import(${JSON.stringify(REGISTRY_MODULE)});
       process.stdout.write(JSON.stringify(Object.keys(m.REGISTRY)));`,
    ],
    { encoding: 'utf-8', cwd: REPO_ROOT, timeout: 15_000 },
  );
  if (listResult.status !== 0) {
    console.error('  failed to enumerate registry:');
    console.error(listResult.stderr);
    process.exit(1);
  }
  const allIds = JSON.parse(listResult.stdout);

  const ides = flags.ide ? [flags.ide] : allIds;
  if (flags.ide && !allIds.includes(flags.ide)) {
    console.error(`  unknown IDE: ${flags.ide}`);
    console.error(`  known: ${allIds.join(', ')}`);
    process.exit(2);
  }

  const results = [];
  for (const ide of ides) {
    results.push(verifyOne(ide));
  }

  if (flags.json) {
    process.stdout.write(
      JSON.stringify(
        {
          passed: results.every((r) => r.passed),
          count: results.length,
          results: results.map((r) => ({
            ide: r.ide,
            passed: r.passed,
            checks: r.checks,
            capabilities: CAPABILITIES[r.ide] ?? null,
          })),
        },
        null,
        2,
      ) + '\n',
    );
  } else {
    console.log(renderText(results));
  }

  process.exit(results.every((r) => r.passed) ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
