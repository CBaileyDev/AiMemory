/**
 * End-to-end test harness for claude-mem IDE integrations.
 *
 * Every installer in `src/services/integrations/*` computes its write target
 * from `homedir()`, `process.cwd()`, and a few environment variables at
 * module load time. The harness:
 *
 *   1. Creates an isolated fake HOME directory under `tmpdir()`.
 *   2. Creates an isolated fake workspace (cwd) directory.
 *   3. Pre-seeds the fake HOME with the marketplace artefacts that the
 *      installers look up — a stub `worker-service.cjs`, `mcp-server.cjs`,
 *      `openclaw/dist/index.js`, `dist/opencode-plugin/index.js`, and the
 *      openclaw manifest. The stubs are plain text; they exist only so
 *      `existsSync()` returns `true` in the installer's path resolution.
 *   4. Runs each installer inside a separate `bun` subprocess so the
 *      module-level constants resolve against the fake HOME — the test
 *      process itself never imports the installer.
 *   5. Exposes helpers for asserting file contents, running the
 *      uninstaller, and computing symmetric-uninstall invariants.
 *
 * No network. No writes outside the sandbox.
 */

import { spawnSync } from 'child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * The list of supported IDE identifiers, mirroring the install command's
 * dispatch table in `src/npx-cli/commands/install.ts`.
 */
export const ALL_IDE_IDS = [
  'claude-code',
  'cursor',
  'gemini-cli',
  'opencode',
  'windsurf',
  'codex-cli',
  'openclaw',
  'copilot-cli',
  'antigravity',
  'goose',
  'crush',
  'roo-code',
  'warp',
  'kimi',
  'claude-desktop',
] as const;

export type IdeId = (typeof ALL_IDE_IDS)[number];

/** Context passed to every installer/uninstaller run. */
export interface Sandbox {
  /** Absolute path to the isolated fake HOME. */
  home: string;
  /** Absolute path to the isolated fake workspace (used as cwd). */
  workspace: string;
  /** Absolute path to the fake marketplace directory the installers see. */
  marketplace: string;
  /** Root of the sandbox — everything is under here. Removed on `destroy`. */
  root: string;
}

export interface RunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

// ---------------------------------------------------------------------------
// Sandbox lifecycle
// ---------------------------------------------------------------------------

/**
 * Create a fresh sandbox under the OS temp dir with a unique suffix.
 * The sandbox contains a fake `$HOME` and a fake workspace (cwd). Installers
 * that look up marketplace artefacts will find seed stubs inside `$HOME`.
 */
export function createSandbox(label: string): Sandbox {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const root = join(tmpdir(), `claude-mem-e2e-${label}-${suffix}`);
  const home = join(root, 'home');
  const workspace = join(root, 'workspace');

  mkdirSync(home, { recursive: true });
  mkdirSync(workspace, { recursive: true });

  const marketplace = join(home, '.claude', 'plugins', 'marketplaces', 'thedotmack');
  seedMarketplace(marketplace);

  return { home, workspace, marketplace, root };
}

/**
 * Remove the sandbox from disk. Best-effort: errors are swallowed so test
 * cleanup never fails the test.
 */
export function destroySandbox(sandbox: Sandbox): void {
  try {
    rmSync(sandbox.root, { recursive: true, force: true });
  } catch {
    // Best-effort cleanup; swallow errors.
  }
}

/**
 * Seed the fake marketplace with the minimum set of files the installers
 * look up during path resolution. The content is intentionally a short
 * comment; we only need `existsSync(path)` to return `true`.
 */
function seedMarketplace(marketplace: string): void {
  mkdirSync(join(marketplace, 'plugin', 'scripts'), { recursive: true });
  mkdirSync(join(marketplace, 'openclaw', 'dist'), { recursive: true });
  mkdirSync(join(marketplace, 'dist', 'opencode-plugin'), { recursive: true });

  writeFileSync(
    join(marketplace, 'plugin', 'scripts', 'worker-service.cjs'),
    '// stub worker-service.cjs for e2e tests\n',
  );
  writeFileSync(
    join(marketplace, 'plugin', 'scripts', 'mcp-server.cjs'),
    '// stub mcp-server.cjs for e2e tests\n',
  );
  writeFileSync(
    join(marketplace, 'openclaw', 'dist', 'index.js'),
    '// stub openclaw plugin bundle for e2e tests\n',
  );
  writeFileSync(
    join(marketplace, 'openclaw', 'openclaw.plugin.json'),
    JSON.stringify(
      { name: 'claude-mem', version: '0.0.0-test', main: 'dist/index.js' },
      null,
      2,
    ),
  );
  writeFileSync(
    join(marketplace, 'dist', 'opencode-plugin', 'index.js'),
    '// stub opencode plugin bundle for e2e tests\n',
  );
}

// ---------------------------------------------------------------------------
// Subprocess runner
// ---------------------------------------------------------------------------

/**
 * Install command table. Each entry is a (async) import path plus the
 * exported installer function name to call. Callers may extend this but
 * should not mutate entries in place — tests rely on the default behaviour.
 */
const INSTALLERS: Record<IdeId, { module: string; fn: string; args?: string }> = {
  'claude-code': {
    // Claude Code uses its native `claude` CLI; there is nothing to
    // install on the file system for claude-mem itself. The test for
    // claude-code exercises the marketplace-copy code path separately.
    module: '',
    fn: '',
  },
  cursor: {
    module: 'src/services/integrations/CursorHooksInstaller.ts',
    fn: 'installCursorHooks',
    args: JSON.stringify('user'),
  },
  'gemini-cli': {
    module: 'src/services/integrations/GeminiCliHooksInstaller.ts',
    fn: 'installGeminiCliHooks',
  },
  opencode: {
    module: 'src/services/integrations/OpenCodeInstaller.ts',
    fn: 'installOpenCodeIntegration',
  },
  windsurf: {
    module: 'src/services/integrations/WindsurfHooksInstaller.ts',
    fn: 'installWindsurfHooks',
  },
  'codex-cli': {
    module: 'src/services/integrations/CodexCliInstaller.ts',
    fn: 'installCodexCli',
  },
  openclaw: {
    module: 'src/services/integrations/OpenClawInstaller.ts',
    fn: 'installOpenClawIntegration',
  },
  'copilot-cli': {
    module: 'src/services/integrations/McpIntegrations.ts',
    fn: 'MCP_IDE_INSTALLERS["copilot-cli"]',
  },
  antigravity: {
    module: 'src/services/integrations/McpIntegrations.ts',
    fn: 'MCP_IDE_INSTALLERS["antigravity"]',
  },
  goose: {
    module: 'src/services/integrations/McpIntegrations.ts',
    fn: 'MCP_IDE_INSTALLERS["goose"]',
  },
  crush: {
    module: 'src/services/integrations/McpIntegrations.ts',
    fn: 'MCP_IDE_INSTALLERS["crush"]',
  },
  'roo-code': {
    module: 'src/services/integrations/McpIntegrations.ts',
    fn: 'MCP_IDE_INSTALLERS["roo-code"]',
  },
  warp: {
    module: 'src/services/integrations/McpIntegrations.ts',
    fn: 'MCP_IDE_INSTALLERS["warp"]',
  },
  kimi: {
    module: 'src/services/integrations/McpIntegrations.ts',
    fn: 'MCP_IDE_INSTALLERS["kimi"]',
  },
  'claude-desktop': {
    module: 'src/services/integrations/McpIntegrations.ts',
    fn: 'MCP_IDE_INSTALLERS["claude-desktop"]',
  },
};

/**
 * Uninstaller table. Tier-1 IDEs have their own uninstallers; MCP IDEs go
 * through `MCP_IDE_UNINSTALLERS` (Phase 2). Entries missing from this map
 * return `{ exitCode: 0, stdout: 'no uninstaller' }` from `runUninstaller`.
 */
const UNINSTALLERS: Partial<Record<IdeId, { module: string; fn: string; args?: string }>> = {
  cursor: {
    module: 'src/services/integrations/CursorHooksInstaller.ts',
    fn: 'uninstallCursorHooks',
    args: JSON.stringify('user'),
  },
  'gemini-cli': {
    module: 'src/services/integrations/GeminiCliHooksInstaller.ts',
    fn: 'uninstallGeminiCliHooks',
  },
  opencode: {
    module: 'src/services/integrations/OpenCodeInstaller.ts',
    fn: 'uninstallOpenCodePlugin',
  },
  windsurf: {
    module: 'src/services/integrations/WindsurfHooksInstaller.ts',
    fn: 'uninstallWindsurfHooks',
  },
  'codex-cli': {
    module: 'src/services/integrations/CodexCliInstaller.ts',
    fn: 'uninstallCodexCli',
  },
  openclaw: {
    module: 'src/services/integrations/OpenClawInstaller.ts',
    fn: 'uninstallOpenClawPlugin',
  },
  // MCP-tier uninstallers come from the Phase 2 map.
  'copilot-cli': {
    module: 'src/services/integrations/McpIntegrations.ts',
    fn: 'MCP_IDE_UNINSTALLERS["copilot-cli"]',
  },
  antigravity: {
    module: 'src/services/integrations/McpIntegrations.ts',
    fn: 'MCP_IDE_UNINSTALLERS["antigravity"]',
  },
  goose: {
    module: 'src/services/integrations/McpIntegrations.ts',
    fn: 'MCP_IDE_UNINSTALLERS["goose"]',
  },
  crush: {
    module: 'src/services/integrations/McpIntegrations.ts',
    fn: 'MCP_IDE_UNINSTALLERS["crush"]',
  },
  'roo-code': {
    module: 'src/services/integrations/McpIntegrations.ts',
    fn: 'MCP_IDE_UNINSTALLERS["roo-code"]',
  },
  warp: {
    module: 'src/services/integrations/McpIntegrations.ts',
    fn: 'MCP_IDE_UNINSTALLERS["warp"]',
  },
  kimi: {
    module: 'src/services/integrations/McpIntegrations.ts',
    fn: 'MCP_IDE_UNINSTALLERS["kimi"]',
  },
  'claude-desktop': {
    module: 'src/services/integrations/McpIntegrations.ts',
    fn: 'MCP_IDE_UNINSTALLERS["claude-desktop"]',
  },
};

/** Spawn a bun subprocess that imports the given module and invokes a fn. */
function runInSandbox(
  sandbox: Sandbox,
  entry: { module: string; fn: string; args?: string },
): RunResult {
  // Resolve from the repo root — tests run from anywhere under the project,
  // but spawnSync's `cwd` option is set to the fake workspace so that
  // installers writing to `process.cwd()` land inside the sandbox.
  const repoRoot = findRepoRoot();
  const modulePath = join(repoRoot, entry.module);

  const argsExpr = entry.args ?? '';
  const script = `
    const mod = await import(${JSON.stringify(modulePath)});
    const target = ${isBracketExpression(entry.fn) ? `mod.${entry.fn}` : `mod[${JSON.stringify(entry.fn)}]`};
    if (typeof target !== 'function') {
      throw new Error('not a function: ${entry.fn}');
    }
    const result = await target(${argsExpr});
    process.exit(typeof result === 'number' ? result : 0);
  `;

  // Windows and Unix both resolve HOME correctly when both vars are set.
  // APPDATA is explicitly redirected for Claude Desktop on Windows, which
  // uses %APPDATA%\Claude\claude_desktop_config.json rather than $HOME.
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    HOME: sandbox.home,
    USERPROFILE: sandbox.home,
    APPDATA: join(sandbox.home, 'AppData', 'Roaming'),
    CLAUDE_CONFIG_DIR: join(sandbox.home, '.claude'),
    CLAUDE_MEM_DATA_DIR: join(sandbox.home, '.claude-mem'),
    OPENCODE_CONFIG_DIR: join(sandbox.home, '.config', 'opencode'),
    // Disable any user-wide settings file that would otherwise steer paths.
    CLAUDE_MEM_E2E_SANDBOX: '1',
  };

  const result = spawnSync('bun', ['-e', script], {
    cwd: sandbox.workspace,
    env,
    encoding: 'utf8',
    timeout: 30_000,
    maxBuffer: 10 * 1024 * 1024,
  });

  return {
    exitCode: typeof result.status === 'number' ? result.status : -1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

/**
 * Some entries in the installer table reference an exported object property
 * such as `MCP_IDE_INSTALLERS["copilot-cli"]`. Those need to be evaluated
 * as-is; flat identifiers need to be indexed via bracket notation for
 * type-safety.
 */
function isBracketExpression(expr: string): boolean {
  return /[[\]]/.test(expr);
}

/** Run the installer for an IDE in the sandbox. */
export function runInstaller(sandbox: Sandbox, ide: IdeId): RunResult {
  const entry = INSTALLERS[ide];
  if (!entry.module) {
    return { exitCode: 0, stdout: '', stderr: 'no-op installer' };
  }
  return runInSandbox(sandbox, entry);
}

/**
 * Run the uninstaller for an IDE in the sandbox. IDEs without a dedicated
 * uninstaller return `{ exitCode: 0, stdout: 'no uninstaller' }` so tests
 * can still assert behaviour uniformly.
 */
export function runUninstaller(sandbox: Sandbox, ide: IdeId): RunResult {
  const entry = UNINSTALLERS[ide];
  if (!entry) {
    return { exitCode: 0, stdout: 'no uninstaller', stderr: '' };
  }
  return runInSandbox(sandbox, entry);
}

// ---------------------------------------------------------------------------
// File-system helpers for assertions
// ---------------------------------------------------------------------------

/** Read a file under the sandbox if it exists; otherwise return null. */
export function readSandboxFile(path: string): string | null {
  if (!existsSync(path)) return null;
  return readFileSync(path, 'utf-8');
}

/** Write a pre-existing "user content" file before running install. */
export function seedFile(absolutePath: string, content: string): void {
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, content, 'utf-8');
}

/** True iff the given file contains claude-mem content. */
export function fileMentionsClaudeMem(path: string): boolean {
  const content = readSandboxFile(path);
  if (content === null) return false;
  return content.includes('claude-mem');
}

// ---------------------------------------------------------------------------
// Repo root resolution
// ---------------------------------------------------------------------------

function findRepoRoot(): string {
  // The harness lives at `<repo>/tests/e2e/harness.ts`. When compiled via
  // `bun test`, __dirname is still the source file's directory, so walk up.
  let dir = __dirname;
  for (let i = 0; i < 10; i++) {
    if (existsSync(join(dir, 'package.json'))) return dir;
    const parent = join(dir, '..');
    if (parent === dir) break;
    dir = parent;
  }
  // Fallback: assume the tests are invoked from the repo root.
  return process.cwd();
}
